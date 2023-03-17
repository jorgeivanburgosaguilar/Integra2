/* eslint-disable prefer-const */
/* eslint-disable prefer-rest-params */
/* eslint-disable one-var */
/* eslint-disable new-cap */
/* eslint-disable no-array-constructor */
/* eslint-disable no-invalid-this */
/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
/* eslint-disable no-var */
(function ($) {
  "use strict";

  var ignoreTagsUser = new Array();
  var recognizeTagsUser = new Array();
  var replacements = new Array();
  var customTags = new Array();

  var rateDefault = 1.1;
  var pitchDefault = 1;
  var volumeDefault = 1;

  var rateUserDefault;
  var pitchUserDefault;
  var volumeUserDefault;
  var voiceUserDefault;

  var rate = rateDefault;
  var pitch = pitchDefault;
  var volume = volumeDefault;
  var voices = new Array();

  function voiceTag(prepend, append) {
    this.prepend = prepend;
    this.append = append;
  }

  function voiceObj(name, language) {
    this.name = name;
    this.language = language;
  }

  // This populates the "voices" array with objects that represent the available voices in the
  // current browser. Each object has two properties: name and language. It is loaded
  // asynchronously in deference to Chrome.

  function populateVoiceList() {
    var systemVoices = speechSynthesis.getVoices();
    for (var i = 0; i < systemVoices.length; i++) {
      voices.push(new voiceObj(systemVoices[i].name, systemVoices[i].lang));
    }
  }

  populateVoiceList();

  if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // After checking for compatability, define the utterance object and then cancel the speech
  // immediately even though nothing is yet spoken. This is to fix a quirk in Windows Chrome.

  if ("speechSynthesis" in window) {
    var speech = new SpeechSynthesisUtterance();
    window.speechSynthesis.cancel();
  }

  // Hated to do a browser detect, but Windows Chrome is a bit buggy and inconsistent with the default
  // voice that it uses unless that default voice ('native') is specified directly -- see line 165.
  // Every browser is fine with 'native' specified directly except Microsoft Edge, which is why
  // this browser detect ened up necessary for the time being. I think this will all resolve itself
  // in future browser versions, but for now, I felt this was the safest solution. But I feel dirty.

  var chrome = /chrome/i.test(navigator.userAgent);
  var edge = /edge/i.test(navigator.userAgent);
  var isChrome = chrome && !edge;

  var methods = {
    speak: function (options) {
      var opts = $.extend({}, $.fn.articulate.defaults, options);

      var toSpeak = "";
      var obj, processed, finished;
      var voiceTags = new Array();

      // Default values.

      voiceTags["q"] = new voiceTag("quote,", ", unquote,");
      voiceTags["ol"] = new voiceTag("Start of list.", "End of list.");
      voiceTags["ul"] = new voiceTag("Start of list.", "End of list.");
      voiceTags["blockquote"] = new voiceTag("Blockquote start.", "Blockquote end.");
      voiceTags["img"] = new voiceTag("There's an embedded image with the description,", "");
      voiceTags["table"] = new voiceTag("There's an embedded table with the caption,", "");
      voiceTags["figure"] = new voiceTag("There's an embedded figure with the caption,", "");

      var ignoreTags = [
        "audio",
        "button",
        "canvas",
        "code",
        "del",
        "dialog",
        "dl",
        "embed",
        "form",
        "head",
        "iframe",
        "meter",
        "nav",
        "noscript",
        "object",
        "s",
        "script",
        "select",
        "style",
        "textarea",
        "video",
      ];

      // Check to see if the browser supports the functionality.

      if (!("speechSynthesis" in window)) {
        alert("Sorry, this browser does not support the Web Speech API.");
        return;
      }

      // If something is currently being spoken, ignore new voice request. Otherwise it would be queued,
      // which is doable if someone wanted that, but not what I wanted.

      if (window.speechSynthesis.speaking) {
        return;
      }

      // Cycle through all the elements in the original jQuery selector, process and clean
      // them one at a time, and continually append it to the variable "toSpeak".

      this.each(function () {
        obj = $(this).clone(); // clone the DOM node and its descendants of what the user wants spoken
        processed = processDOMelements(obj); // process and manipulate DOM tree of this clone
        processed = jQuery(processed).html(); // convert the result of all that to a string
        finished = cleanDOMelements(processed); // do some text manipulation
        toSpeak = toSpeak + " " + finished; // add it to what will ultimately be spoken after cycling through selectors
      });

      // Check if users have set their own rate/pitch/volume defaults, otherwise use defaults.

      if (rateUserDefault !== undefined) {
        rate = rateUserDefault;
      } else {
        rate = rateDefault;
      }

      if (pitchUserDefault !== undefined) {
        pitch = pitchUserDefault;
      } else {
        pitch = pitchDefault;
      }

      if (volumeUserDefault !== undefined) {
        volume = volumeUserDefault;
      } else {
        volume = volumeDefault;
      }

      // To debug, un-comment the following to see exactly what's about to be spoken.
      // console.log(toSpeak);

      // This is where the magic happens. Well, not magic, but at least we can finally hear something.
      // After the line that fixes the Windows Chrome quirk, the custom voice is set if one has been chosen.

      speech = new SpeechSynthesisUtterance();
      speech.text = toSpeak;
      speech.rate = rate;
      speech.pitch = pitch;
      speech.volume = volume;
      if (isChrome) {
        speech.voice = speechSynthesis.getVoices().filter(function (voice) {
          return voice.name == "native";
        })[0];
      }
      if (voiceUserDefault !== undefined) {
        speech.voice = speechSynthesis.getVoices().filter(function (voice) {
          return voice.name == voiceUserDefault;
        })[0];
      }
      window.speechSynthesis.speak(speech);

      var count = 0;
      var r = setInterval(function () {
        // console.log(synth.speaking);
        count = count + 1;
        // console.log("elapsedTime:"+count);
        if (count == 13 && window.speechSynthesis.speaking) {
          count = 0;
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else window.speechSynthesis.resume();
      }, 1000);

      function processDOMelements(clone) {
        var copy, prepend;

        // Remove tags from the "ignoreTags" array because the user called "articulate('recognize')"
        // and said he/she doesn't want some tags un-spoken. Double negative there, but it does make sense.

        if (recognizeTagsUser.length > 0) {
          for (var prop in recognizeTagsUser) {
            var index = ignoreTags.indexOf(recognizeTagsUser[prop]);
            if (index > -1) {
              ignoreTags.splice(index, 1);
            }
          }
        }

        // Remove DOM objects from those listed in the "ignoreTags" array now that the user has specified
        // which ones, if any, he/she wants to keep.

        for (var prop in ignoreTags) {
          jQuery(clone)
            .find(ignoreTags[prop])
            .addBack(ignoreTags[prop])
            .not("[data-articulate-recognize]")
            .each(function () {
              jQuery(this).html("");
            });
        }

        // Remove DOM objects as specified in the "ignoreTagsUser" array that the user specified when
        // calling "articulate('ignore')".

        if (ignoreTagsUser.length > 0) {
          for (var prop in ignoreTagsUser) {
            jQuery(clone)
              .find(ignoreTagsUser[prop])
              .addBack(ignoreTagsUser[prop])
              .not("[data-articulate-recognize]")
              .each(function () {
                jQuery(this).html("");
              });
          }
        }

        // Remove DOM objects as specified in the HTML with "data-articulate-ignore".

        jQuery(clone)
          .find("[data-articulate-ignore]")
          .addBack("[data-articulate-ignore]")
          .each(function () {
            jQuery(this).html("");
          });

        // Search for prepend data as specified in the HTML with "data-articulate-prepend".

        jQuery(clone)
          .find("[data-articulate-prepend]")
          .addBack("[data-articulate-prepend]")
          .each(function () {
            copy = jQuery(this).data("articulate-prepend");
            jQuery(this).prepend(copy + " ");
          });

        // Search for append data as specified in the HTML with "data-articulate-append".

        jQuery(clone)
          .find("[data-articulate-append]")
          .addBack("[data-articulate-append]")
          .each(function () {
            copy = jQuery(this).data("articulate-append");
            jQuery(this).append(" " + copy);
          });

        // Search for tags to prepend and append as specified by the "voiceTags" array.

        var count = 0;

        for (var tag in voiceTags) {
          count++;
          if (count <= 4) {
            jQuery(clone)
              .find(tag)
              .each(function () {
                if (customTags[tag]) {
                  jQuery(this).prepend(customTags[tag].prepend + " ");
                  jQuery(this).append(" " + customTags[tag].append);
                } else {
                  jQuery(this).prepend(voiceTags[tag].prepend + " ");
                  jQuery(this).append(" " + voiceTags[tag].append);
                }
              });
          }
        }

        // Search for <h1> through <h6> and <li> and <br> to add a pause at the end of those tags. This is done
        // because these tags require a pause, but often don't have a comma or period at the end of their text.

        jQuery(clone)
          .find("h1,h2,h3,h4,h5,h6,li,p")
          .addBack("h1,h2,h3,h4,h5,h6,li,p")
          .each(function () {
            jQuery(this).append(". ");
          });

        jQuery(clone)
          .find("br")
          .each(function () {
            jQuery(this).after(", ");
          });

        // Search for <figure>, check for <figcaption>, insert that text if it exists
        // and then remove the whole DOM object

        jQuery(clone)
          .find("figure")
          .addBack("figure")
          .each(function () {
            copy = jQuery(this).find("figcaption").html();
            if (customTags["figure"]) {
              prepend = customTags["figure"].prepend;
            } else {
              prepend = voiceTags["figure"].prepend;
            }
            if (copy != undefined && copy !== "") {
              jQuery("<div>" + prepend + " " + copy + ".</div>").insertBefore(this);
            }
            jQuery(this).remove();
          });

        // Search for <image>, check for ALT attribute, insert that text if it exists and then
        // remove the whole DOM object. Had to make adjustments for nesting in <picture> tags.

        jQuery(clone)
          .find("img")
          .addBack("img")
          .each(function () {
            copy = jQuery(this).attr("alt");
            var parent = jQuery(this).parent();
            var parentName = parent.get(0).tagName;

            if (customTags["img"]) {
              prepend = customTags["img"].prepend;
            } else {
              prepend = voiceTags["img"].prepend;
            }

            if (copy !== undefined && copy != "") {
              if (parentName == "PICTURE") {
                var par;
                jQuery("<div>" + prepend + " " + copy + ".</div>").insertBefore(parent);
              } else {
                jQuery("<div>" + prepend + " " + copy + ".</div>").insertBefore(this);
              }
            }
            jQuery(this).remove();
          });

        // Search for <table>, check for <caption>, insert that text if it exists
        // and then remove the whole DOM object.

        jQuery(clone)
          .find("table")
          .addBack("table")
          .each(function () {
            copy = jQuery(this).find("caption").text();
            if (customTags["table"]) {
              prepend = customTags["table"].prepend;
            } else {
              prepend = voiceTags["table"].prepend;
            }
            if (copy !== undefined && copy != "") {
              jQuery("<div>" + prepend + " " + copy + ".</div>").insertBefore(this);
            }
            jQuery(this).remove();
          });

        // Search for DOM object to be replaced as specified in the HTML with "data-articulate-swap".

        jQuery(clone)
          .find("[data-articulate-swap]")
          .addBack("[data-articulate-swap]")
          .each(function () {
            copy = jQuery(this).data("articulate-swap");
            jQuery(this).text(copy);
          });

        // Search for DOM object to spelled out as specified in the HTML with "data-articulate-spell".
        // I find this function fun if, admittedly, not too practical.

        jQuery(clone)
          .find("[data-articulate-spell]")
          .addBack("[data-articulate-spell]")
          .each(function () {
            copy = jQuery(this).text();
            copy = copy.split("").join(" ");
            jQuery(this).text(copy);
          });

        return clone;
      }

      function cleanDOMelements(final) {
        var start, ended, speak, part1, part2, final;

        // Search for <articulate> in comments, copy the text, place it outside the comment,
        // and then splice together "final" string again, which omits the comment.

        while (final.indexOf("<!-- <articulate>") != -1) {
          start = final.indexOf("<!-- <articulate>");
          ended = final.indexOf("</articulate> -->", start);

          if (ended == -1) {
            break;
          }

          speak = final.substring(start + 17, ended);
          part1 = final.substring(0, start);
          part2 = final.substring(ended + 17);
          final = part1 + " " + speak + " " + part2;
        }

        // Strip out remaining comments.

        final = final.replace(/<!--[\s\S]*?-->/g, "");

        // Strip out remaining HTML tags.

        final = final.replace(/(<([^>]+)>)/gi, "");

        // Replace a string of characters with another as specified by "articulate('replace')".

        var len = replacements.length;
        var i = 0;
        var old, rep;

        while (i < len) {
          old = replacements[i];
          old = old.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          rep = replacements[i + 1] + " ";
          var regexp = new RegExp(old, "gi");
          var final = final.replace(regexp, rep);
          i = i + 2;
        }

        // Replace double smart quotes with proper text, same as what was done previously with <q>.

        if (customTags["q"]) {
          final = final.replace(/â/g, customTags["q"].prepend + " ");
          final = final.replace(/â/g, " " + customTags["q"].append);
        } else {
          final = final.replace(/â/g, voiceTags["q"].prepend + " ");
          final = final.replace(/â/g, " " + voiceTags["q"].append);
        }

        // Replace em-dashes and double-dashes with a pause since the browser doesn't do so when reading.

        final = final.replace(/â/g, ", ");
        final = final.replace(/--/g, ", ");

        // When read from the DOM, a few special characters (&amp; for example) display as their hex codes
        // rather than resolving into their actual character -- this technique fixes that.

        var txt = document.createElement("textarea");
        txt.innerHTML = final;
        final = txt.value;

        // Strip out new line characters and carriage returns, which cause unwanted pauses.

        final = final.replace(/(\r\n|\n|\r)/gm, "");

        // Strip out multiple spaces and periods and commas -- for neatness more than anything else since
        // none of this will affect the speech. But it helps when checking progress in the console.

        final = final.replace(/  +/g, " ");
        final = final.replace(/\.\./g, ".");
        final = final.replace(/,,/g, ",");
        final = final.replace(/ ,/g, ",");

        return final;
      }

      return this;
    },

    // All the functions for Articulate.js.

    pause: function () {
      window.speechSynthesis.pause();
      return this;
    },

    resume: function () {
      window.speechSynthesis.resume();
      return this;
    },

    stop: function () {
      window.speechSynthesis.cancel();
      return this;
    },

    enabled: function () {
      return "speechSynthesis" in window;
    },

    isSpeaking: function () {
      return window.speechSynthesis.speaking;
    },

    isPaused: function () {
      return window.speechSynthesis.paused;
    },

    rate: function () {
      var num = arguments[0];
      if (num >= 0.1 && num <= 10) {
        rateUserDefault = num;
      } else if (num === undefined) {
        rateUserDefault = void 0;
        rate = rateDefault;
      }
      return this;
    },

    pitch: function () {
      var num = arguments[0];
      if (num >= 0.1 && num <= 2) {
        pitchUserDefault = num;
      } else if (num === undefined) {
        pitchUserDefault = void 0;
        pitch = pitchDefault;
      }
      return this;
    },

    volume: function () {
      var num = arguments[0];
      if (num >= 0 && num <= 1) {
        volumeUserDefault = num;
      } else if (num === undefined) {
        volumeUserDefault = void 0;
        volume = volumeDefault;
      }
      return this;
    },

    ignore: function () {
      var len = arguments.length;
      ignoreTagsUser.length = 0;
      while (len > 0) {
        len--;
        ignoreTagsUser.push(arguments[len]);
      }
      return this;
    },

    recognize: function () {
      var len = arguments.length;
      recognizeTagsUser.length = 0;
      while (len > 0) {
        len--;
        recognizeTagsUser.push(arguments[len]);
      }
      return this;
    },

    replace: function () {
      var len = arguments.length;
      replacements.length = 0;
      var i = 0;
      while (i < len) {
        replacements.push(arguments[i], arguments[i + 1]);
        i = i + 2;
        if (len - i == 1) {
          break;
        }
      }
      return this;
    },

    customize: function () {
      var len = arguments.length;
      if (len == 0) {
        customTags = [];
      }
      if (len == 2) {
        if (["img", "table", "figure"].indexOf(arguments[0]) == -1) {
          console.log(
            "Error: When customizing, tag indicated must be either 'img', 'table', or 'figure'."
          );
          return;
        }
        customTags[arguments[0].toString()] = new voiceTag(arguments[1].toString());
      }
      if (len == 3) {
        if (["q", "ol", "ul", "blockquote"].indexOf(arguments[0]) == -1) {
          console.log(
            "Error: When customizing, tag indicated must be either 'q', 'ol', 'ul' or 'blockquote'."
          );
          return;
        }
        customTags[arguments[0].toString()] = new voiceTag(
          arguments[1].toString(),
          arguments[2].toString()
        );
      }
      return this;
    },

    getVoices: function () {
      // If no arguments, then the user has requested the array of voices populated earlier.

      if (arguments.length == 0) {
        return voices;
      }

      // If there's another argument, we'll assume it's a jQuery selector designating where to put the dropdown menu.
      // And if there's a third argument, that will be custom text for the dropdown menu.
      // Then we'll create a dropdown menu with the voice names and, in parenthesis, the language code.

      var obj = jQuery(arguments[0]);
      var customTxt = "Choose a Different Voice";

      if (arguments[1] !== undefined) {
        customTxt = arguments[1];
      }

      obj.append(
        jQuery("<select id='voiceSelect'><option value='none'>" + customTxt + "</option></select>")
      );
      for (var i = 0; i < voices.length; i++) {
        var option = document.createElement("option");
        option.textContent = voices[i].name + " (" + voices[i].language + ")";
        option.setAttribute("value", voices[i].name);
        option.setAttribute("data-articulate-language", voices[i].language);
        obj.find("select").append(option);
      }

      // Add an onchange event to the dropdown menu.

      obj.on("change", function () {
        jQuery(this)
          .find("option:selected")
          .each(function () {
            if (jQuery(this).val() != "none") {
              voiceUserDefault = jQuery(this).val();
            }
          });
      });
      return this;
    },

    setVoice: function () {
      // The setVoice function has to have two attributes -- if not, exit the function.

      if (arguments.length < 2) {
        return this;
      }

      var requestedVoice, requestedLanguage;

      // User wants to change the voice directly. If that name indeed exists, update the "voiceUserDefault" variable.

      if (arguments[0] == "name") {
        requestedVoice = arguments[1];
        for (var i = 0; i < voices.length; i++) {
          if (voices[i].name == requestedVoice) {
            voiceUserDefault = requestedVoice;
          }
        }
      }

      // User wants to change the voice by only specifying the first two characters of the language code. Case insensitive.

      if (arguments[0] == "language") {
        requestedLanguage = arguments[1].toUpperCase();
        if (requestedLanguage.length == 2) {
          for (var i = 0; i < voices.length; i++) {
            if (voices[i].language.substring(0, 2).toUpperCase() == requestedLanguage) {
              voiceUserDefault = voices[i].name;
              break;
            }
          }
        } else {
          // User wants to change the voice by specifying the complete language code.

          for (var i = 0; i < voices.length; i++) {
            if (voices[i].language == requestedLanguage) {
              voiceUserDefault = voices[i].name;
              break;
            }
          }
        }
      }
      return this;
    },
  };

  $.fn.articulate = function (method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === "object" || !method) {
      return methods.speak.apply(this, arguments);
    } else {
      jQuery.error("Method " + method + " does not exist on jQuery.articulate");
    }
  };
})(jQuery);

// ------------

var integra2_ip;
var integra2_lat;
var integra2_lon;
var integra2_city;
var integra2_region_name;
var integra2_country_name;
var integra2_geolocation_err;
var integra2_geolocation_err_desc;

function integra2_speak(obj) {
  var speaking = jQuery().articulate("isSpeaking");
  var paused = jQuery().articulate("isPaused");

  // $().articulate('setVoice','name','Google espa&ntilde;ol de Estados Unidos');
  jQuery().articulate("setVoice", "name", "Microsoft Sabina - Spanish (Mexico)");
  // $().articulate('getVoices', 'es-US', 'Choose a New Voice');
  // $().articulate('setVoice','name',voice);
  jQuery().articulate("setVoice", "language", "es-US");

  // This is how you can use one button for a speak/pause toggle
  // Is browser speaking? (This returns 'true' even when paused)
  // If it is, is speaking paused? If paused, then resume; otherwise pause
  // If it isn't, then initiate speaking

  if (speaking) {
    if (paused) {
      jQuery().articulate("resume");
    } else {
      jQuery().articulate("pause");
    }
  } else {
    // $(obj).articulate('speak');
    jQuery("h1, h2, h3, h4, p, label").articulate("rate", 1.0).articulate("speak");
  }
}

function integra2_stop() {
  jQuery().articulate("stop");
}

var jq_integra2_Uso;
$(document).ready(function () {
  jq_integra2_Uso = function (tipo) {
    integra2_Uso(tipo);
  };

  function integra2_Uso(tipo) {
    void 0;
    // integra2_ip = 0;

    // var sel = $("script[src^='https://www.infomexsinaloa.org/accesibilidadweb/js_api.aspx']").attr(
    //   "src"
    // );

    // sel = sel.replace("js_api.aspx", "js_api_alpha.aspx");
    // serror = "";

    // $.getJSON(sel + "&uso=" + tipo + "&ip=" + integra2_ip + "&error=" + serror, function (data) {});
  }

  if (localStorage["locationc"] === "locationc1") {
    $("#imgpos").css(
      "background-image",
      "url(https://www.infomexsinaloa.org/accesibilidadweb/icons/positiondownleft.svg)"
    );
  }

  SetClass();

  // AGREGAMOS LAS CLASES SELECCIONADAS EN EL LOCALSTORAGE
  function SetClass() {
    // registra uso en estad&iacute;stica
    if (localStorage["integra2_size"] || localStorage["integra2_size"] === "") {
      if (localStorage["integra2_size"].length > 0) {
        integra2_Uso("text-size");
      }
    }
    if (localStorage["contrastview_step"] || localStorage["contrastview_step"] === "") {
      if (localStorage["contrastview_step"].length > 0) {
        integra2_Uso("contraste");
      }
    }
    if (localStorage["vozactiva"] === "true") {
      integra2_Uso("voz");
    }
    if (localStorage["body_focusx"] || localStorage["body_focusx"] === "") {
      if (localStorage["body_focusx"].length > 0) {
        integra2_Uso("teclado");
      }
    }
    if (localStorage["a_integra2_linkcolor"] || localStorage["a_integra2_linkcolor"] === "") {
      if (localStorage["a_integra2_linkcolor"].length > 0) {
        integra2_Uso("hipervinculos");
      }
    }
    if (localStorage["integra2_letterspace"] || localStorage["integra2_letterspace"] === "") {
      if (localStorage["integra2_letterspace"].length > 0) {
        integra2_Uso("espacios");
      }
    }
    if (localStorage["html_apagatransition"] || localStorage["html_apagatransition"] === "") {
      if (localStorage["html_apagatransition"].length > 0) {
        integra2_Uso("sin-animaciones");
      }
    }
    if (localStorage["integra2_legible"] || localStorage["integra2_legible"] === "") {
      if (localStorage["integra2_legible"].length > 0) {
        integra2_Uso("texto-legible");
      }
    }
    if (localStorage["body_pointerx"] || localStorage["body_pointerx"] === "") {
      if (localStorage["body_pointerx"].length > 0) {
        integra2_Uso("puntero");
      }
    }
    if (localStorage["readline_active"] || localStorage["readline_active"] === "") {
      if (localStorage["readline_active"].length > 0) {
        integra2_Uso("linea-de-lectura");
      }
    }

    // ANTES DE ASIGNAR LA CLASE, REVISA SI LA VARIABLE YA TIENE UN VALOR
    $("#integra2_myBtn").addClass(localStorage["fab_location"]);
    $("#lemodaleposition").addClass(localStorage["fab_location"]);
    $("#imgpos").addClass(localStorage["locationc"]);

    $("html").addClass(localStorage["html_contrastview"]);
    $("html").addClass(localStorage["html_apagatransition"]);
    $("body").addClass(localStorage["body_pointerx"]);
    $("body").addClass(localStorage["body_focusx"]);

    $("p").addClass(localStorage["integra2_size"]);
    $("p").addClass(localStorage["integra2_letterspace"]);
    $("p").addClass(localStorage["integra2_legible"]);
    $("p").addClass(localStorage["integra2_size_active"]);
    $("a").addClass(localStorage["a_integra2_linkcolor"]);
    $("a").addClass(localStorage["integra2_size"]);
    $("a").addClass(localStorage["integra2_letterspace"]);
    $("a").addClass(localStorage["integra2_legible"]);
    $("label").addClass(localStorage["integra2_size"]);
    $("label").addClass(localStorage["integra2_legible"]);
    $("label").addClass(localStorage["integra2_letterspace"]);

    $("#contrastview_active").addClass(localStorage["contrastview_active"]);
    $("#contrastview_checked").addClass(localStorage["contrastview_checked"]);
    $("#contrastview_step").addClass(localStorage["contrastview_step"]);
    $("#readline_active").addClass(localStorage["readline_active"]);
    $("#readline_active_checked").addClass(localStorage["readline_active_checked"]);
    $("#pointerx_active").addClass(localStorage["pointerx_active"]);
    $("#pointerx_checked").addClass(localStorage["pointerx_checked"]);
    $("#integra2_linkcolor_active").addClass(localStorage["integra2_linkcolor_active"]);
    $("#integra2_linkcolor_checked").addClass(localStorage["integra2_linkcolor_checked"]);
    $("#letterspace_active").addClass(localStorage["letterspace_active"]);
    $("#letterspace_checked").addClass(localStorage["letterspace_checked"]);
    $("#letterspace_step").addClass(localStorage["letterspace_step"]);
    $("#legible_active").addClass(localStorage["legible_active"]);
    $("#legible_checked").addClass(localStorage["legible_checked"]);
    $("#apagatransition_active").addClass(localStorage["apagatransition_active"]);
    $("#apagatransition_checked").addClass(localStorage["apagatransition_checked"]);
    $("#size_active").addClass(localStorage["size_active"]);
    $("#size_checked").addClass(localStorage["size_checked"]);
    $("#size_step").addClass(localStorage["size_step"]);
    $("#focus_active").addClass(localStorage["focus_active"]);
    $("#focus_checked").addClass(localStorage["focus_checked"]);

    $("#location_step").addClass(localStorage["location_step"]);

    if (localStorage["vozactiva"] === "true") {
      $("#voice_active").addClass("activatedcell");
      $("#voice_checked").addClass("iconchecked");
    } else {
      $("#voice_active").removeClass("activatedcell");
      $("#voice_checked").removeClass("iconchecked");
    }

    if (localStorage["readline_active"] === "activatedcell") {
      hiderule();
    }
  }

  // =================== INICIO BOTON RESET ===================
  // RESETEAMOS LAS CLASES CON EL BOTON RESET
  $("#resetb").click(function (e) {
    $("#integra2_myBtn").removeClass(localStorage["fab_location"]);
    $("#lemodaleposition").removeClass(localStorage["fab_location"]);
    $("#imgpos").removeClass(localStorage["locationc"]);
    $("#imgpos").css(
      "background-image",
      "url(https://www.infomexsinaloa.org/accesibilidadweb/icons/positiondownright.svg)"
    );

    $("html").removeClass(localStorage["html_contrastview"]);
    $("html").removeClass(localStorage["html_apagatransition"]);
    $("body").removeClass(localStorage["body_pointerx"]);
    $("body").removeClass(localStorage["body_focusx"]);

    $("p").removeClass(localStorage["integra2_size"]);
    $("p").removeClass(localStorage["integra2_letterspace"]);
    $("p").removeClass(localStorage["integra2_legible"]);
    $("p").removeClass(localStorage["integra2_size_active"]);

    $("a").removeClass(localStorage["a_integra2_linkcolor"]);
    $("a").removeClass(localStorage["integra2_size"]);
    $("a").removeClass(localStorage["integra2_letterspace"]);
    $("a").removeClass(localStorage["integra2_legible"]);
    $("a").removeClass(localStorage["integra2_size_active"]);
    $("label").removeClass(localStorage["integra2_size"]);
    $("label").removeClass(localStorage["integra2_legible"]);
    $("label").removeClass(localStorage["integra2_letterspace"]);

    $("#contrastview_active").removeClass(localStorage["contrastview_active"]);
    $("#contrastview_checked").removeClass(localStorage["contrastview_checked"]);
    $("#contrastview_step").removeClass(localStorage["contrastview_step"]);
    $("#readline_active").removeClass(localStorage["readline_active"]);
    $("#readline_active_checked").removeClass(localStorage["readline_active_checked"]);
    $("#pointerx_active").removeClass(localStorage["pointerx_active"]);
    $("#pointerx_checked").removeClass(localStorage["pointerx_checked"]);
    $("#integra2_linkcolor_active").removeClass(localStorage["integra2_linkcolor_active"]);
    $("#integra2_linkcolor_checked").removeClass(localStorage["integra2_linkcolor_checked"]);
    $("#letterspace_active").removeClass(localStorage["letterspace_active"]);
    $("#letterspace_checked").removeClass(localStorage["letterspace_checked"]);
    $("#letterspace_step").removeClass(localStorage["letterspace_step"]);
    $("#legible_active").removeClass(localStorage["legible_active"]);
    $("#legible_checked").removeClass(localStorage["legible_checked"]);
    $("#apagatransition_active").removeClass(localStorage["apagatransition_active"]);
    $("#apagatransition_checked").removeClass(localStorage["apagatransition_checked"]);
    $("#size_active").removeClass(localStorage["size_active"]);
    $("#size_checked").removeClass(localStorage["size_checked"]);
    $("#size_step").removeClass(localStorage["size_step"]);
    $("#focus_active").removeClass(localStorage["focus_active"]);
    $("#focus_checked").removeClass(localStorage["focus_checked"]);

    $("#location_step").removeClass(localStorage["location_step"]);

    // Reseteamos las clases guardadas en localStorage
    hiderule2();
    localStorage.clear();
  });
  // =================== INICIO BOTON RESET ===================
  // RESETEAMOS LAS CLASES CON EL BOTON RESET
  $("#resetb").keypress(function (e) {
    $("#integra2_myBtn").removeClass(localStorage["fab_location"]);
    $("#lemodaleposition").removeClass(localStorage["fab_location"]);
    $("#imgpos").removeClass(localStorage["locationc"]);
    $("#imgpos").css(
      "background-image",
      "url(https://www.infomexsinaloa.org/accesibilidadweb/icons/positiondownright.svg)"
    );

    $("html").removeClass(localStorage["html_contrastview"]);
    $("html").removeClass(localStorage["html_apagatransition"]);
    $("body").removeClass(localStorage["body_pointerx"]);
    $("body").removeClass(localStorage["body_focusx"]);

    $("p").removeClass(localStorage["integra2_size"]);
    $("p").removeClass(localStorage["integra2_letterspace"]);
    $("p").removeClass(localStorage["integra2_legible"]);
    $("p").removeClass(localStorage["integra2_size_active"]);

    $("a").removeClass(localStorage["a_integra2_linkcolor"]);
    $("a").removeClass(localStorage["integra2_size"]);
    $("a").removeClass(localStorage["integra2_letterspace"]);
    $("a").removeClass(localStorage["integra2_legible"]);
    $("a").removeClass(localStorage["integra2_size_active"]);
    $("label").removeClass(localStorage["integra2_size"]);
    $("label").removeClass(localStorage["integra2_legible"]);
    $("label").removeClass(localStorage["integra2_letterspace"]);

    $("#contrastview_active").removeClass(localStorage["contrastview_active"]);
    $("#contrastview_checked").removeClass(localStorage["contrastview_checked"]);
    $("#contrastview_step").removeClass(localStorage["contrastview_step"]);
    $("#readline_active").removeClass(localStorage["readline_active"]);
    $("#readline_active_checked").removeClass(localStorage["readline_active_checked"]);
    $("#pointerx_active").removeClass(localStorage["pointerx_active"]);
    $("#pointerx_checked").removeClass(localStorage["pointerx_checked"]);
    $("#integra2_linkcolor_active").removeClass(localStorage["integra2_linkcolor_active"]);
    $("#integra2_linkcolor_checked").removeClass(localStorage["integra2_linkcolor_checked"]);
    $("#letterspace_active").removeClass(localStorage["letterspace_active"]);
    $("#letterspace_checked").removeClass(localStorage["letterspace_checked"]);
    $("#letterspace_step").removeClass(localStorage["letterspace_step"]);
    $("#legible_active").removeClass(localStorage["legible_active"]);
    $("#legible_checked").removeClass(localStorage["legible_checked"]);
    $("#apagatransition_active").removeClass(localStorage["apagatransition_active"]);
    $("#apagatransition_checked").removeClass(localStorage["apagatransition_checked"]);
    $("#size_active").removeClass(localStorage["size_active"]);
    $("#size_checked").removeClass(localStorage["size_checked"]);
    $("#size_step").removeClass(localStorage["size_step"]);
    $("#focus_active").removeClass(localStorage["focus_active"]);
    $("#focus_checked").removeClass(localStorage["focus_checked"]);

    $("#location_step").removeClass(localStorage["location_step"]);

    // Reseteamos las clases guardadas en localStorage
    hiderule2();
    localStorage.clear();
  });

  // ============================================================================ 01 INICIO FOCUS ============================================================================
  var classesfocusx = ["integra2_elfocus", "reset"];
  $("#focusx").click(function (e) {
    classesfocusx.push(classesfocusx.shift());
    if (classesfocusx[classesfocusx.length - 1] === "reset") {
      $("body").removeClass("integra2_elfocus reset");
      $("#focus_active").removeClass("activatedcell", "reset");
      $("#focus_checked").removeClass("iconchecked");
      localStorage["body_focusx"] = "";
      localStorage["focus_active"] = "";
      localStorage["focus_checked"] = "";
    } else {
      $("body")
        .removeClass(classesfocusx.join(" "))
        .addClass(classesfocusx[classesfocusx.length - 1]);
      $("#focus_active").addClass("activatedcell");
      $("#focus_checked").addClass("iconchecked");
      localStorage["body_focusx"] = classesfocusx[classesfocusx.length - 1];
      localStorage["focus_active"] = "activatedcell";
      localStorage["focus_checked"] = "iconchecked";

      integra2_Uso("teclado");
    }
  });

  // ============================================================================ 01 INICIO FOCUS TECLA ENTER ============================================================================
  var classesfocusx = ["integra2_elfocus", "reset"];
  $("#focusx").keypress(function (e) {
    if (e.which == 13) {
      classesfocusx.push(classesfocusx.shift());
      if (classesfocusx[classesfocusx.length - 1] === "reset") {
        $("body").removeClass("integra2_elfocus reset");
        $("#focus_active").removeClass("activatedcell", "reset");
        $("#focus_checked").removeClass("iconchecked");
        localStorage["body_focusx"] = "";
        localStorage["focus_active"] = "";
        localStorage["focus_checked"] = "";
      } else {
        $("body")
          .removeClass(classesfocusx.join(" "))
          .addClass(classesfocusx[classesfocusx.length - 1]);
        $("#focus_active").addClass("activatedcell");
        $("#focus_checked").addClass("iconchecked");
        localStorage["body_focusx"] = classesfocusx[classesfocusx.length - 1];
        localStorage["focus_active"] = "activatedcell";
        localStorage["focus_checked"] = "iconchecked";

        integra2_Uso("teclado");
      }
    }
  });

  // ============================================================================ 02 INICIO VOZ ============================================================================

  var classesvoz = ["voz", "reset"];

  $("#voice").click(function (e) {
    classesvoz.push(classesvoz.shift());
    if (classesvoz[classesvoz.length - 1] === "reset") {
      $("#voice_active").removeClass("activatedcell");
      $("#voice_checked").removeClass("iconchecked");
      window.speechSynthesis.pause();
      if (typeof Storage !== "undefined") {
        localStorage.setItem("vozactiva", "false");
      }
    } else {
      $("#voice_active").addClass("activatedcell");
      $("#voice_checked").addClass("iconchecked");
      // registra uso en estad&iacute;stica
      integra2_Uso("voz");

      if (typeof Storage !== "undefined") {
        localStorage.setItem("vozactiva", "true");
      }
    }
  });

  // ===================== 02 INICIO VOZ Insert + ArrowDown para hablar y Ctrl para Detener ============================================================================

  var classesvoz = ["voz", "reset"];
  var i2_keys = {};
  document.addEventListener("keydown", function (event) {
    i2_keys[event.key] = true;

    if (i2_keys["Insert"] === true && i2_keys["ArrowDown"] === true) {
      integra2_Uso("voz");
      integra2_speak();

      let i2_msg = new SpeechSynthesisUtterance();
      let i2_voices = speechSynthesis.getVoices();
      i2_msg.voice = i2_voices["Microsoft Sabina - Spanish (Mexico)"];
      i2_msg.lang = "es-US";
      let i2_tags = document.querySelectorAll("p,a,h1,h2,h3,label");
      i2_tags.forEach((i2_tag) => {
        i2_tag.addEventListener("focus", (e) => {
          i2_msg.text = e.target.innerText;
          speechSynthesis.speak(i2_msg);

          let i2_interval = setInterval(() => {
            if (!speechSynthesis.speaking) {
              clearInterval(i2_interval);
            }
          }, 100);
        });
      });
    }
  });
  document.addEventListener("keydown", function (event) {
    i2_keys[event.key] = true;
    if (i2_keys["Control"] === true) {
      classesvoz.push(classesvoz.shift());
      if (classesvoz[classesvoz.length - 1] === "reset") {
        $("#voice_active").removeClass("activatedcell");
        $("#voice_checked").removeClass("iconchecked");
      }
      integra2_stop();
    }
  });
  document.addEventListener("keyup", function (event) {
    delete i2_keys[event.key];
  });

  // ============================================================================ 03 INICIO CONTRASTE ============================================================================
  var contrastview = [
    "integra2-contrast-1",
    "integra2-contrast-2",
    "integra2-contrast-3",
    "integra2-contrast-4",
    "reset",
  ];
  $("#contrastview").click(function (e) {
    contrastview.push(contrastview.shift());
    if (contrastview[contrastview.length - 1] === "reset") {
      $("html").removeClass(
        "integra2-contrast-1 integra2-contrast-2 integra2-contrast-3 integra2-contrast-4 reset"
      );
      $("#contrastview_active").removeClass("activatedcell");
      $("#contrastview_checked").removeClass("iconchecked");
      localStorage["html_contrastview"] = "";
      localStorage["contrastview_active"] = "";
      localStorage["contrastview_checked"] = "";
    } else {
      $("html")
        .removeClass(contrastview.join(" "))
        .addClass(contrastview[contrastview.length - 1]);
      $("#contrastview_active").addClass("activatedcell");
      $("#contrastview_checked").addClass("iconchecked");
      localStorage["html_contrastview"] = contrastview[contrastview.length - 1];
      localStorage["contrastview_active"] = "activatedcell";
      localStorage["contrastview_checked"] = "iconchecked";
      integra2_Uso("contraste");
    }
  });

  var contrastviewstep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#contrastview").click(function (e) {
    contrastviewstep.push(contrastviewstep.shift());
    if (contrastviewstep[contrastviewstep.length - 1] === "reset") {
      $("#contrastview_step").removeClass(
        "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
      );
      localStorage["contrastview_step"] = "";
    } else {
      $("#contrastview_step")
        .removeClass(contrastviewstep.join(" "))
        .addClass(contrastviewstep[contrastviewstep.length - 1]);
      localStorage["contrastview_step"] = contrastviewstep[contrastviewstep.length - 1];
    }
  });

  // =========================================================  03 INICIO CONTRASTE TECLA ENTER=========================================================
  var contrastview = [
    "integra2-contrast-1",
    "integra2-contrast-2",
    "integra2-contrast-3",
    "integra2-contrast-4",
    "reset",
  ];
  $("#contrastview").keypress(function (e) {
    if (e.which == 13) {
      contrastview.push(contrastview.shift());
      if (contrastview[contrastview.length - 1] === "reset") {
        $("html").removeClass(
          "integra2-contrast-1 integra2-contrast-2 integra2-contrast-3 integra2-contrast-4 reset"
        );
        $("#contrastview_active").removeClass("activatedcell");
        $("#contrastview_checked").removeClass("iconchecked");
        localStorage["body_contrastview"] = "";
        localStorage["contrastview_active"] = "";
        localStorage["contrastview_checked"] = "";
      } else {
        $("html")
          .removeClass(contrastview.join(" "))
          .addClass(contrastview[contrastview.length - 1]);
        $("#contrastview_active").addClass("activatedcell");
        $("#contrastview_checked").addClass("iconchecked");
        localStorage["body_contrastview"] = contrastview[contrastview.length - 1];
        localStorage["contrastview_active"] = "activatedcell";
        localStorage["contrastview_checked"] = "iconchecked";
        integra2_Uso("contraste");
      }
    }
  });

  var contrastviewstep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#contrastview").keypress(function (e) {
    if (e.which == 13) {
      contrastviewstep.push(contrastviewstep.shift());
      if (contrastviewstep[contrastviewstep.length - 1] === "reset") {
        $("#contrastview_step").removeClass(
          "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
        );
        localStorage["contrastview_step"] = "";
      } else {
        $("#contrastview_step")
          .removeClass(contrastviewstep.join(" "))
          .addClass(contrastviewstep[contrastviewstep.length - 1]);
        localStorage["contrastview_step"] = contrastviewstep[contrastviewstep.length - 1];
      }
    }
  });

  // ============================================================================ 04 INICIO LINK COLOR ============================================================================
  var classesintegra2_linkcolor = ["integra2_linkcolor", "reset"];
  $("#integra2_linkcolor").click(function (e) {
    classesintegra2_linkcolor.push(classesintegra2_linkcolor.shift());
    if (classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1] === "reset") {
      $("a").removeClass("integra2_linkcolor reset");
      $("#integra2_linkcolor_active").removeClass("activatedcell");
      $("#integra2_linkcolor_checked").removeClass("iconchecked");
      localStorage["a_integra2_linkcolor"] = "";
      localStorage["integra2_linkcolor_active"] = "";
      localStorage["integra2_linkcolor_checked"] = "";
    } else {
      $("a")
        .removeClass(classesintegra2_linkcolor.join(" "))
        .addClass(classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1]);
      $("#integra2_linkcolor_active").addClass("activatedcell");
      $("#integra2_linkcolor_checked").addClass("iconchecked");
      localStorage["a_integra2_linkcolor"] =
        classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1];
      localStorage["integra2_linkcolor_active"] = "activatedcell";
      localStorage["integra2_linkcolor_checked"] = "iconchecked";
      integra2_Uso("hipervinculos");
    }
  });

  // ========================================================= 04 INICIO LINK COLOR TECLA ENTER=========================================================
  var classesintegra2_linkcolor = ["integra2_linkcolor", "reset"];
  $("#integra2_linkcolor").keypress(function (e) {
    if (e.which == 13) {
      classesintegra2_linkcolor.push(classesintegra2_linkcolor.shift());
      if (classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1] === "reset") {
        $("a").removeClass("integra2_linkcolor reset");
        $("#integra2_linkcolor_active").removeClass("activatedcell");
        $("#integra2_linkcolor_checked").removeClass("iconchecked");
        localStorage["a_integra2_linkcolor"] = "";
        localStorage["integra2_linkcolor_active"] = "";
        localStorage["integra2_linkcolor_checked"] = "";
      } else {
        $("a")
          .removeClass(classesintegra2_linkcolor.join(" "))
          .addClass(classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1]);
        $("#integra2_linkcolor_active").addClass("activatedcell");
        $("#integra2_linkcolor_checked").addClass("iconchecked");
        localStorage["a_integra2_linkcolor"] =
          classesintegra2_linkcolor[classesintegra2_linkcolor.length - 1];
        localStorage["integra2_linkcolor_active"] = "activatedcell";
        localStorage["integra2_linkcolor_checked"] = "iconchecked";
        integra2_Uso("hipervinculos");
      }
    }
  });

  // =================== 05 INICIO TAMA&ntilde;O TEXTO ===================
  var classes = ["integra2_size1", "integra2_size2", "integra2_size3", "integra2_size4", "reset"];
  $("#size").click(function (e) {
    classes.push(classes.shift());
    if (classes[classes.length - 1] === "reset") {
      $("p").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
      $("a").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
      $("label").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
      $("#size_active").removeClass("activatedcell");
      $("#size_checked").removeClass("iconchecked");
      localStorage["integra2_size"] = "";
      localStorage["a_size"] = "";
      localStorage["size_active"] = "";
      localStorage["size_checked"] = "";
    } else {
      $("p")
        .removeClass(classes.join(" "))
        .addClass(classes[classes.length - 1]);
      $("a")
        .removeClass(classes.join(" "))
        .addClass(classes[classes.length - 1]);
      $("label")
        .removeClass(classes.join(" "))
        .addClass(classes[classes.length - 1]);
      $("#size_active").addClass("activatedcell activatedcellchecked");
      $("#size_checked").addClass("iconchecked");
      localStorage["integra2_size"] = classes[classes.length - 1];
      localStorage["size_active"] = "activatedcell";
      localStorage["size_checked"] = "iconchecked";

      // registra uso en estad&iacute;stica
      if (localStorage["integra2_size"] === "integra2_size1") {
        integra2_Uso("text-size");
      }
    }
  });

  var classessizestep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#size").click(function (e) {
    classessizestep.push(classessizestep.shift());
    if (classessizestep[classessizestep.length - 1] === "reset") {
      $("#size_step").removeClass(
        "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
      );
      localStorage["size_step"] = "";
    } else {
      $("#size_step")
        .removeClass(classessizestep.join(" "))
        .addClass(classessizestep[classessizestep.length - 1]);
      localStorage["size_step"] = classessizestep[classessizestep.length - 1];
    }
  });

  // =================== 05 INICIO TAMA&ntilde;O TEXTO TECLA ENTER===================
  var classes = ["integra2_size1", "integra2_size2", "integra2_size3", "integra2_size4", "reset"];
  $("#size").keypress(function (e) {
    if (e.which == 13) {
      classes.push(classes.shift());
      if (classes[classes.length - 1] === "reset") {
        $("p").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
        $("a").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
        $("label").removeClass("integra2_size1 integra2_size2 integra2_size3 integra2_size4 reset");
        $("#size_active").removeClass("activatedcell");
        $("#size_checked").removeClass("iconchecked");
        localStorage["integra2_size"] = "";
        localStorage["size_active"] = "";
        localStorage["size_checked"] = "";
      } else {
        $("p")
          .removeClass(classes.join(" "))
          .addClass(classes[classes.length - 1]);
        $("a")
          .removeClass(classes.join(" "))
          .addClass(classes[classes.length - 1]);
        $("label")
          .removeClass(classes.join(" "))
          .addClass(classes[classes.length - 1]);
        $("#size_active").addClass("activatedcell activatedcellchecked");
        $("#size_checked").addClass("iconchecked");
        localStorage["integra2_size"] = classes[classes.length - 1];
        localStorage["size_active"] = "activatedcell";
        localStorage["size_checked"] = "iconchecked";

        // registra uso en estad&iacute;stica
        if (localStorage["integra2_size"] === "integra2_size1") {
          integra2_Uso("text-size");
        }
      }
    }
  });

  var classessizestep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#size").keypress(function (e) {
    if (e.which == 13) {
      classessizestep.push(classessizestep.shift());
      if (classessizestep[classessizestep.length - 1] === "reset") {
        $("#size_step").removeClass(
          "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
        );
        localStorage["size_step"] = "";
      } else {
        $("#size_step")
          .removeClass(classessizestep.join(" "))
          .addClass(classessizestep[classessizestep.length - 1]);
        localStorage["size_step"] = classessizestep[classessizestep.length - 1];
      }
    }
  });

  // ============================================================================  06 INICIO ESPACIO ENTRE LETRAS ============================================================================
  var classesletterspace = [
    "integra2_linespace1",
    "integra2_linespace2",
    "integra2_linespace3",
    "integra2_linespace4",
    "reset",
  ];
  $("#letterspace").click(function (e) {
    classesletterspace.push(classesletterspace.shift());
    if (classesletterspace[classesletterspace.length - 1] === "reset") {
      $("p").removeClass(
        "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
      );
      $("a").removeClass(
        "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
      );
      $("label").removeClass(
        "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
      );
      $("#letterspace_active").removeClass("activatedcell");
      $("#letterspace_checked").removeClass("iconchecked");
      localStorage["integra2_letterspace"] = "";
      localStorage["letterspace_active"] = "";
      localStorage["letterspace_checked"] = "";
    } else {
      $("p")
        .removeClass(classesletterspace.join(" "))
        .addClass(classesletterspace[classesletterspace.length - 1]);
      $("a")
        .removeClass(classesletterspace.join(" "))
        .addClass(classesletterspace[classesletterspace.length - 1]);
      $("label")
        .removeClass(classesletterspace.join(" "))
        .addClass(classesletterspace[classesletterspace.length - 1]);
      $("#letterspace_active").addClass("activatedcell");
      $("#letterspace_checked").addClass("iconchecked");
      localStorage["integra2_letterspace"] = classesletterspace[classesletterspace.length - 1];
      localStorage["letterspace_active"] = "activatedcell";
      localStorage["letterspace_checked"] = "iconchecked";
      integra2_Uso("espacios");
    }
  });

  var classesletterspacestep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#letterspace").click(function (e) {
    classesletterspacestep.push(classesletterspacestep.shift());
    if (classesletterspacestep[classesletterspacestep.length - 1] === "reset") {
      $("#letterspace_step").removeClass(
        "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
      );
      localStorage["letterspace_step"] = "";
    } else {
      $("#letterspace_step")
        .removeClass(classesletterspacestep.join(" "))
        .addClass(classesletterspacestep[classesletterspacestep.length - 1]);
      localStorage["letterspace_step"] = classesletterspacestep[classesletterspacestep.length - 1];
    }
  });

  // ======================================================================== 06 INICIO ESPACIO ENTRE LETRAS TECLA ENTER======================================================================
  var classesletterspace = [
    "integra2_linespace1",
    "integra2_linespace2",
    "integra2_linespace3",
    "integra2_linespace4",
    "reset",
  ];
  $("#letterspace").keypress(function (e) {
    if (e.which == 13) {
      classesletterspace.push(classesletterspace.shift());
      if (classesletterspace[classesletterspace.length - 1] === "reset") {
        $("p").removeClass(
          "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
        );
        $("a").removeClass(
          "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
        );
        $("label").removeClass(
          "integra2_linespace1 integra2_linespace2 integra2_linespace3 integra2_linespace4 reset"
        );
        $("#letterspace_active").removeClass("activatedcell");
        $("#letterspace_checked").removeClass("iconchecked");
        localStorage["integra2_letterspace"] = "";
        localStorage["letterspace_active"] = "";
        localStorage["letterspace_checked"] = "";
      } else {
        $("p")
          .removeClass(classesletterspace.join(" "))
          .addClass(classesletterspace[classesletterspace.length - 1]);
        $("a")
          .removeClass(classesletterspace.join(" "))
          .addClass(classesletterspace[classesletterspace.length - 1]);
        $("label")
          .removeClass(classesletterspace.join(" "))
          .addClass(classesletterspace[classesletterspace.length - 1]);
        $("#letterspace_active").addClass("activatedcell");
        $("#letterspace_checked").addClass("iconchecked");
        localStorage["integra2_letterspace"] = classesletterspace[classesletterspace.length - 1];
        localStorage["letterspace_active"] = "activatedcell";
        localStorage["letterspace_checked"] = "iconchecked";
        integra2_Uso("espacios");
      }
    }
  });

  var classesletterspacestep = [
    "integra2_size_step1",
    "integra2_size_step2",
    "integra2_size_step3",
    "integra2_size_step4",
    "reset",
  ];
  $("#letterspace").keypress(function (e) {
    if (e.which == 13) {
      classesletterspacestep.push(classesletterspacestep.shift());
      if (classesletterspacestep[classesletterspacestep.length - 1] === "reset") {
        $("#letterspace_step").removeClass(
          "integra2_size_step1 integra2_size_step2 integra2_size_step3 integra2_size_step4 reset"
        );
        localStorage["letterspace_step"] = "";
      } else {
        $("#letterspace_step")
          .removeClass(classesletterspacestep.join(" "))
          .addClass(classesletterspacestep[classesletterspacestep.length - 1]);
        localStorage["letterspace_step"] =
          classesletterspacestep[classesletterspacestep.length - 1];
      }
    }
  });

  // ============================================================================ 07 INICIO TRANSICION ============================================================================
  var classesapagatransition = ["apagatransition1", "reset"];
  $("#apagatransition").click(function (e) {
    classesapagatransition.push(classesapagatransition.shift());
    if (classesapagatransition[classesapagatransition.length - 1] === "reset") {
      $("html").removeClass("apagatransition1 reset");
      $("#apagatransition_active").removeClass("activatedcell");
      $("#apagatransition_checked").removeClass("iconchecked");
      localStorage["html_apagatransition"] = "";
      localStorage["apagatransition_active"] = "";
      localStorage["apagatransition_checked"] = "";
    } else {
      $("html")
        .removeClass(classesapagatransition.join(" "))
        .addClass(classesapagatransition[classesapagatransition.length - 1]);
      $("#apagatransition_active").addClass("activatedcell");
      $("#apagatransition_checked").addClass("iconchecked");
      localStorage["html_apagatransition"] =
        classesapagatransition[classesapagatransition.length - 1];
      localStorage["apagatransition_active"] = "activatedcell";
      localStorage["apagatransition_checked"] = "iconchecked";
      integra2_Uso("sin-animaciones");
    }
  });

  // ========================================================= 07 INICIO TRANSICION TECLA ENTER =========================================================
  var classesapagatransition = ["apagatransition1", "reset"];
  $("#apagatransition").keypress(function (e) {
    if (e.which == 13) {
      classesapagatransition.push(classesapagatransition.shift());
      if (classesapagatransition[classesapagatransition.length - 1] === "reset") {
        $("html").removeClass("apagatransition1 reset");
        $("#apagatransition_active").removeClass("activatedcell");
        $("#apagatransition_checked").removeClass("iconchecked");
        localStorage["html_apagatransition"] = "";
        localStorage["apagatransition_active"] = "";
        localStorage["apagatransition_checked"] = "";
      } else {
        $("html")
          .removeClass(classesapagatransition.join(" "))
          .addClass(classesapagatransition[classesapagatransition.length - 1]);
        $("#apagatransition_active").addClass("activatedcell");
        $("#apagatransition_checked").addClass("iconchecked");
        localStorage["html_apagatransition"] =
          classesapagatransition[classesapagatransition.length - 1];
        localStorage["apagatransition_active"] = "activatedcell";
        localStorage["apagatransition_checked"] = "iconchecked";
        integra2_Uso("sin-animaciones");
      }
    }
  });

  // ============================================================================ 08 INICIO LEGIBLE ============================================================================
  var classeslegible = ["integra2_legible1", "reset"];
  $("#legible").click(function (e) {
    classeslegible.push(classeslegible.shift());
    if (classeslegible[classeslegible.length - 1] === "reset") {
      $("p").removeClass("integra2_legible1 reset");
      $("a").removeClass("integra2_legible1 reset");
      $("label").removeClass("integra2_legible1 reset");
      $("#legible_active").removeClass("activatedcell");
      $("#legible_checked").removeClass("iconchecked");
      localStorage["integra2_legible"] = "";
      localStorage["legible_active"] = "";
      localStorage["legible_checked"] = "";
    } else {
      $("p")
        .removeClass(classeslegible.join(" "))
        .addClass(classeslegible[classeslegible.length - 1]);
      $("a")
        .removeClass(classeslegible.join(" "))
        .addClass(classeslegible[classeslegible.length - 1]);
      $("label")
        .removeClass(classeslegible.join(" "))
        .addClass(classeslegible[classeslegible.length - 1]);
      $("#legible_active").addClass("activatedcell");
      $("#legible_checked").addClass("iconchecked");
      localStorage["integra2_legible"] = classeslegible[classeslegible.length - 1];
      localStorage["legible_active"] = "activatedcell";
      localStorage["legible_checked"] = "iconchecked";
      integra2_Uso("texto-legible");
    }
  });

  // ============================================================================ 08 INICIO LEGIBLE TECLA ENTER ============================================================================
  var classeslegible = ["integra2_legible1", "reset"];
  $("#legible").keypress(function (e) {
    if (e.which == 13) {
      classeslegible.push(classeslegible.shift());
      if (classeslegible[classeslegible.length - 1] === "reset") {
        $("p").removeClass("integra2_legible1 reset");
        $("a").removeClass("integra2_legible1 reset");
        $("label").removeClass("integra2_legible1 reset");
        $("#legible_active").removeClass("activatedcell");
        $("#legible_checked").removeClass("iconchecked");
        localStorage["integra2_legible"] = "";
        localStorage["legible_checked"] = "";
      } else {
        $("p")
          .removeClass(classeslegible.join(" "))
          .addClass(classeslegible[classeslegible.length - 1]);
        $("a")
          .removeClass(classeslegible.join(" "))
          .addClass(classeslegible[classeslegible.length - 1]);
        $("label")
          .removeClass(classeslegible.join(" "))
          .addClass(classeslegible[classeslegible.length - 1]);
        $("#legible_active").addClass("activatedcell");
        $("#legible_checked").addClass("iconchecked");
        localStorage["integra2_legible"] = classeslegible[classeslegible.length - 1];
        localStorage["legible_active"] = "activatedcell";
        localStorage["legible_checked"] = "iconchecked";
        integra2_Uso("texto-legible");
      }
    }
  });

  // ========================================================= 09 INICIO CURSOR =========================================================
  if (localStorage["pointerx_active"] === "activatedcell") {
    var classespointerx = ["reset", "integra2_pointer1"];
  } else {
    var classespointerx = ["integra2_pointer1", "reset"];
  }

  $("#pointerx").click(function (e) {
    classespointerx.push(classespointerx.shift());
    if (classespointerx[classespointerx.length - 1] === "reset") {
      $("body").removeClass("integra2_pointer1 reset");
      $("#pointerx_active").removeClass("activatedcell", "reset");
      $("#pointerx_checked").removeClass("iconchecked");
      localStorage["body_pointerx"] = "";
      localStorage["pointerx_active"] = "";
      localStorage["pointerx_checked"] = "";
    } else {
      $("body")
        .removeClass(classespointerx.join(" "))
        .addClass(classespointerx[classespointerx.length - 1]);
      $("#pointerx_active").addClass("activatedcell");
      $("#pointerx_checked").addClass("iconchecked");
      localStorage["body_pointerx"] = classespointerx[classespointerx.length - 1];
      localStorage["pointerx_active"] = "activatedcell";
      localStorage["pointerx_checked"] = "iconchecked";
      integra2_Uso("puntero");
    }
  });

  // ========================================================= 09 INICIO CURSOR TECLA ENTER=========================================================
  // var classespointerx = ["integra2_pointer1", "reset"];
  $("#pointerx").keypress(function (e) {
    if (e.which == 13) {
      classespointerx.push(classespointerx.shift());
      if (classespointerx[classespointerx.length - 1] === "reset") {
        $("body").removeClass("integra2_pointer1 reset");
        $("#pointerx_active").removeClass("activatedcell", "reset");
        $("#pointerx_checked").removeClass("iconchecked");
        localStorage["body_pointerx"] = "";
        localStorage["pointerx_active"] = "";
        localStorage["pointerx_checked"] = "";
      } else {
        $("body")
          .removeClass(classespointerx.join(" "))
          .addClass(classespointerx[classespointerx.length - 1]);
        $("#pointerx_active").addClass("activatedcell");
        $("#pointerx_checked").addClass("iconchecked");
        localStorage["body_pointerx"] = classespointerx[classespointerx.length - 1];
        localStorage["pointerx_active"] = "activatedcell";
        localStorage["pointerx_checked"] = "iconchecked";
        integra2_Uso("puntero");
      }
    }
  });

  // ============================================================================ 10 INICIO LINEA DE LECTURA ============================================================================
  var classesreadline = ["activatedcell", "reset"];

  $("#readline_active").click(function (e) {
    classesreadline.push(classesreadline.shift());
    if (classesreadline[classesreadline.length - 1] === "reset") {
      $("#readline_active").removeClass("activatedcell");
      $("#readline_active_checked").removeClass("iconchecked", "reset");
      localStorage["readline_active"] = "";
      localStorage["readline_active_checked"] = "";
    } else {
      $("#readline_active").addClass("activatedcell");
      $("#readline_active_checked").addClass("iconchecked");
      localStorage["readline_active"] = "activatedcell";
      localStorage["readline_active_checked"] = "iconchecked";
      integra2_Uso("linea-de-lectura");
    }
  });

  // ========================================================= 10 INICIO LINEA DE LECTURA TECLA ENTER=========================================================

  var classesreadline = ["activatedcell", "reset"];
  $("#readline_active").keypress(function (e) {
    if (e.which == 13) {
      classesreadline.push(classesreadline.shift());
      if (classesreadline[classesreadline.length - 1] === "reset") {
        $("#readline_active").removeClass("activatedcell");
        $("#readline_active_checked").removeClass("iconchecked", "reset");
        localStorage["readline_active"] = "";
        localStorage["readline_active_checked"] = "";
        hiderule2();
      } else {
        $("#readline_active").addClass("activatedcell");
        $("#readline_active_checked").addClass("iconchecked");
        localStorage["readline_active"] = "activatedcell";
        localStorage["readline_active_checked"] = "iconchecked";
        integra2_Uso("linea-de-lectura");
        hiderule();
      }
    }
  });

  // =================== 12 INICIO UBICACI&oacute;N ===================
  var class_location = ["integra2_location1", "reset"];
  var class_locationnn = ["locationc1", "reset"];
  $("#location").click(function (e) {
    class_location.push(class_location.shift());
    class_locationnn.push(class_locationnn.shift());

    if (class_location[class_location.length - 1] === "reset") {
      $("#imgpos").removeClass("locationc1 locationc2 reset");
      $("#imgpos").css(
        "background-image",
        "url(https://www.infomexsinaloa.org/accesibilidadweb/icons/positiondownright.svg)"
      );
      $("#integra2_myBtn").removeClass("integra2_location1  reset");
      $("#lemodaleposition").removeClass("integra2_location1  reset");
      $("#location_active").removeClass("activatedcell");
      $("#location_checked").removeClass("iconchecked");
      localStorage["locationc"] = "";
      localStorage["fab_location"] = "";
      localStorage["location_active"] = "";
      localStorage["location_checked"] = "";
    } else {
      $("#imgpos")
        .removeClass(class_locationnn.join(" "))
        .addClass(class_locationnn[class_locationnn.length - 1]);
      if ($("#imgpos").hasClass("locationc1")) {
        $("#imgpos").css("background-image", "");
      }
      $("#integra2_myBtn")
        .removeClass(class_location.join(" "))
        .addClass(class_location[class_location.length - 1]);
      $("#lemodaleposition")
        .removeClass(class_location.join(" "))
        .addClass(class_location[class_location.length - 1]);
      $("#location_active").addClass("activatedcell activatedcellchecked");
      $("#location_checked").addClass("iconchecked");
      if ($("#integra2_myBtn").hasClass("integra2_location2")) {
        $("#lemodaleposition").css("bottom", "unset");
      }
      if ($("#integra2_myBtn").hasClass("integra2_location3")) {
        $("#lemodaleposition").css("bottom", "unset");
      }

      localStorage["fab_location"] = class_location[class_location.length - 1];
      localStorage["locationc"] = class_locationnn[class_locationnn.length - 1];
      localStorage["location_active"] = "activatedcell";
      localStorage["location_checked"] = "iconchecked";
    }
  });

  // =================== 12 INICIO UBICACI&oacute;N CON TECLA ENTER ===================
  var class_location = ["integra2_location1", "reset"];
  var class_locationnn = ["locationc1", "reset"];
  $("#location").keypress(function (e) {
    if (e.which == 13) {
      class_location.push(class_location.shift());
      class_locationnn.push(class_locationnn.shift());

      if (class_location[class_location.length - 1] === "reset") {
        $("#imgpos").removeClass("locationc1 locationc2 reset");
        $("#imgpos").css(
          "background-image",
          "url(https://www.infomexsinaloa.org/accesibilidadweb/icons/positiondownright.svg)"
        );
        $("#integra2_myBtn").removeClass("integra2_location1  reset");
        $("#lemodaleposition").removeClass("integra2_location1  reset");
        $("#location_active").removeClass("activatedcell");
        $("#location_checked").removeClass("iconchecked");
        localStorage["locationc"] = "";
        localStorage["fab_location"] = "";
        localStorage["location_active"] = "";
        localStorage["location_checked"] = "";
      } else {
        $("#imgpos")
          .removeClass(class_locationnn.join(" "))
          .addClass(class_locationnn[class_locationnn.length - 1]);
        if ($("#imgpos").hasClass("locationc1")) {
          $("#imgpos").css("background-image", "");
        }
        $("#integra2_myBtn")
          .removeClass(class_location.join(" "))
          .addClass(class_location[class_location.length - 1]);
        $("#lemodaleposition")
          .removeClass(class_location.join(" "))
          .addClass(class_location[class_location.length - 1]);
        $("#location_active").addClass("activatedcell activatedcellchecked");
        $("#location_checked").addClass("iconchecked");
        if ($("#integra2_myBtn").hasClass("integra2_location2")) {
          $("#lemodaleposition").css("bottom", "unset");
        }
        if ($("#integra2_myBtn").hasClass("integra2_location3")) {
          $("#lemodaleposition").css("bottom", "unset");
        }

        localStorage["fab_location"] = class_location[class_location.length - 1];
        localStorage["locationc"] = class_locationnn[class_locationnn.length - 1];
        localStorage["location_active"] = "activatedcell";
        localStorage["location_checked"] = "iconchecked";
      }
    }
  });
});

// LEMODALE.JS
function getSelectionText() {
  var text = "";
  if (window.getSelection) {
    text = window.getSelection().toString();
    // for Internet Explorer 8 and below. For Blogger, you should use &amp;&amp; instead of &&.
  } else if (document.selection && document.selection.type != "Control") {
    text = document.selection.createRange().text;
  }
  return text;
}
$(document).ready(function () {
  // when the document has completed loading

  $(document).mouseup(function (e) {
    // attach the mouseup event for all div and pre tags
    setTimeout(function () {
      // When clicking on a highlighted area, the value stays highlighted until after the mouseup event, and would therefore stil be captured by getSelection. This micro-timeout solves the issue.
      // console.log(getSelectionText());
      // console.log(localStorage.getItem("vozactiva")+1);

      if (localStorage.getItem("vozactiva") == "true") {
        var synth = window.speechSynthesis;
        var voices = synth.getVoices();
        var u = new SpeechSynthesisUtterance(getSelectionText());
        u.lang = "es-US";

        synth.cancel();

        synth.speak(u);

        var count = 0;
        var r = setInterval(function () {
          // console.log(synth.speaking);
          count = count + 1;
          // console.log("elapsedTime:"+count);
          if (count == 13 && synth.speaking) {
            count = 0;
            synth.pause();
            synth.resume();
          } else synth.resume();
        }, 1000);
      }
    }, 1);
  });
});

function clic2() {
  play2();

  async function play2() {
    var sentences = [];

    var sentences = document.body.getElementsByTagName("*");
    console.log("sentences.length:" + sentences.length);

    for (i = 0; i < sentences.length; i++) {
      var current = sentences[i];
      if (
        current.children.length === 0 &&
        current.textContent.replace(/ |\n/g, "") !== "" &&
        current != "[object HTMLScriptElement]" &&
        current != "[object HTMLStyleElement]"
        // && current != '[object HTMLTableCellElement]' && current != '[object HTMLTableRowElement]' && current != '[object HTMLTableSectionElement]'
      ) {
        console.log("current:" + current);
        document.onkeydown = function (evt) {
          evt = evt || window.event;
          if (evt.keyCode == 37) {
            // Flecha Izquierda
            i = i - 2;
          }
          if (evt.keyCode == 39) {
            // Flecha Derecha
            i = i + 1;
          }
        };

        await getNextAudio2(sentences[i], i);
        // var idestilo="prueba"+i;
        current.classList.remove("bloque_hablando");
        // console.log("Remove Clase");
      }
    }

    async function getNextAudio2(sentence, i) {
      console.log(sentence);
      console.log("iteracion:" + i);
      let audio = new SpeechSynthesisUtterance(sentence.innerText);
      audio.lang = "es-US";
      window.speechSynthesis.speak(audio);

      audio.onstart = sentence.classList.add("bloque_hablando");

      return new Promise((resolve) => {
        audio.onend = resolve;
      });
    }
  }
}

// EXTRAE LOS HIPERVINCULOS PARA LA VENTANA MODAL
var x = document.querySelectorAll("a");

var integra2_myarray = [];
for (var i = 0; i < x.length; i++) {
  var nametext = x[i].textContent;
  var cleantext = nametext.replace(/\s+/g, " ").trim();
  var cleanlink = x[i].href;
  integra2_myarray.push([cleantext, cleanlink]);
}
function integra2_make_table() {
  var integra2_tablelinks = "<table><thead><th></th></thead><tbody>";
  for (var i = 0; i < integra2_myarray.length; i++) {
    if (integra2_myarray[i][0].length > 0) {
      integra2_tablelinks +=
        "<tr><td><a href='" +
        integra2_myarray[i][1] +
        "' target='_blank'>" +
        integra2_myarray[i][0] +
        "</a></td></tr>";
    }
  }
  document.getElementById("integra2_links").innerHTML = integra2_tablelinks;
  jq_integra2_Uso("links");
}

// variable Modal y modal de links
var modal = document.getElementById("lemodale");
var modal2 = document.getElementById("lemodale2");

// variable del boton y se abre el modal y modal de links
var btn = document.getElementById("integra2_myBtn");
var btn2 = document.getElementById("integra2_Btnlinks");

// Variable del span que cierra el modal y modal de links
var span = document.getElementsByClassName("integra2_close")[0];
var span2 = document.getElementsByClassName("integra2_close2")[0];

// Se abre el modal con un clic sobre el boton y modal de links
btn.onclick = function () {
  modal.style.display = "block";
};
btn2.onclick = function () {
  modal2.style.display = "block";
};

// Se cierra el modal con el <span> (x) y modal de links
span.onclick = function () {
  $("#lemodale").hide();
};
span2.onclick = function () {
  $("#lemodale2").hide();
};

// Se cierra el modal al hacer clic en cualquier parte de la pÃ¡gina
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// El Modal se cierra con la tecla Esc y se abre con Ctrl+m
document.onkeydown = function (evt) {
  evt = evt || window.event;
  if (evt.keyCode == 27) {
    modal.style.display = "none";
    modal2.style.display = "none";
  }
  if (evt.ctrlKey && evt.keyCode == 77) {
    if (modal.style.display === "block") {
      modal.style.display = "none";
      modal2.style.display = "none";
    } else {
      modal.style.display = "block";
    }
  }
  if (evt.ctrlKey && evt.keyCode == 118) {
    modal2.style.display = "block";
    document.getElementById("integra2_text_focus").focus();
    integra2_make_table();
  }
};

// Funciones para la guia de lectura (la primera la pinta, la segunda la activa o desactiva)
var $readline = $("#readline");

$(document).on("mousemove", function (evt) {
  $readline.css({ left: 0, top: evt.pageY + 10 });
});

function hiderule() {
  var x = document.getElementById("readline");
  if (x.style.display === "flex") {
    x.style.display = "none";
  } else {
    x.style.display = "flex";
  }
}

function hiderule2() {
  var x = document.getElementById("readline");
  x.style.display = "none";
}
// Funciones para la guia de lectura (la primera la pinta, la segunda la activa o desactiva)
