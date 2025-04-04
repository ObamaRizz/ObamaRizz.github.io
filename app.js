var readInterval = null,
    readIndex = 0, // Index of the *next* chunk to be read
    preparedChunks = [],
    prefs = {
        speed: 200,
        night: false,
        merge: true
    };

/**
 * Updates the progress indicator display.
 * @param {number} current - The current word/chunk index (1-based for display).
 * @param {number} total - The total number of words/chunks.
 */
function updateProgressDisplay(current, total) {
    $('#current-word').text(current);
    $('#total-words').text(total);
    $('#text-info').show(); // Ensure it's visible
}

/**
 * Prepares the text for reading by splitting it into chunks (words or equations).
 * Handles merging of short words based on preferences.
 * @param {string} text - The raw text input.
 */
function prepare(text) {
    preparedChunks = []; // Reset chunks

    // Regex to match TeX equations ($$...$$ or $...$) or sequences of non-whitespace characters (words)
    var regex = /(\$\$.*?\$\$)|(\$.*?\$)|([^\s]+)/g;
    var words = text.match(regex) || []; // Ensure words is an array even if no matches

    var merged = false,
        dotPattern = /.*\.$/; // Simple pattern to check if a word ends with a dot

    for (var i = 0; i < words.length; i++) {
        var currentWord = $.trim(words[i]); // Trim whitespace from the matched word/equation
        if (currentWord !== '') {
            var isSentenceEnd = dotPattern.test(currentWord); // Check if it ends with a period

            // Check conditions for merging short words
            var shouldMerge = prefs.merge &&
                              currentWord.length <= 3 &&
                              !merged && // Don't merge twice in a row
                              preparedChunks.length > 0 && // Must have a previous chunk to merge with
                              !currentWord.startsWith('$'); // Don't merge TeX equations

            if (shouldMerge) {
                var lastChunkIndex = preparedChunks.length - 1;
                preparedChunks[lastChunkIndex].text += ' ' + currentWord;
                // If the merged word marks sentence end, update the chunk
                if (isSentenceEnd) {
                    preparedChunks[lastChunkIndex].sentenceEnd = true;
                }
                merged = true; // Mark that a merge just happened
            } else {
                // Add the word/equation as a new chunk
                preparedChunks.push({ text: currentWord, sentenceEnd: isSentenceEnd });
                merged = false; // Reset merge flag
            }
        }
    }

    // Update the total words display and reset current word display
    updateProgressDisplay(0, preparedChunks.length);

    // Mark the text as prepared
    $('body').data('prepared', true);

    // Update the progress bar range
    $('#text-progress').attr({
        'max': preparedChunks.length > 0 ? preparedChunks.length : 1, // Prevent max=0 if empty
        'value': 0
    }).show(); // Show progress bar immediately after preparing
}

/**
 * Starts the reading interval timer.
 */
function start() {
    if (preparedChunks.length === 0 || readIndex >= preparedChunks.length) {
         // Don't start if no chunks or already at the end
        stop(); // Ensure UI is in stopped state
        readIndex = 0; // Reset index if needed
        updateProgressDisplay(0, preparedChunks.length); // Update display
        $('#text-progress').val(0); // Reset progress bar
        return false;
    }
    // Calculate interval based on WPM
    var interval = 60000 / prefs.speed; // 60,000 ms per minute
    readInterval = window.setInterval(flashWords, interval);
    $('#start').html('Pause'); // Change button text
    $('body').data('reading', true); // Set reading state
}

/**
 * Stops the reading interval timer.
 */
function stop() {
    window.clearInterval(readInterval);
    $('#start').html('Read!'); // Change button text
    $('body').data('reading', false); // Set reading state
    // Don't reset readIndex here, allow resuming
}

/**
 * Function called by the interval timer to display the next word/chunk.
 */
function flashWords() {
    // Check if we have reached the end
    if (readIndex >= preparedChunks.length) {
        stop();
        // Ensure the display shows the final count when stopped at the end
        updateProgressDisplay(preparedChunks.length, preparedChunks.length);
        $('#text-progress').val(preparedChunks.length); // Set progress bar to max
        return; // Exit function
    }

    var chunk = preparedChunks[readIndex]; // Get the current chunk

    // Display the chunk text/equation
    $('#word').html(chunk.text);

    // If the chunk is a MathJax equation, re-typeset the #word element
    if (chunk.text.includes('$')) {
         // Use try-catch as MathJax calls can sometimes fail
        try {
            MathJax.typesetPromise([document.getElementById('word')]).catch(function (err) {
                console.error("MathJax typesetting error:", err);
                 // Display raw text if typesetting fails
                 $('#word').html($('<div/>').text(chunk.text).html()); // Display as plain text
            });
        } catch (err) {
             console.error("Error calling MathJax:", err);
             $('#word').html($('<div/>').text(chunk.text).html()); // Display as plain text
        }
    }

    // Update the progress display (use readIndex + 1 for 1-based counting)
    updateProgressDisplay(readIndex + 1, preparedChunks.length);

    // Update the progress bar value
    $('#text-progress').val(readIndex + 1);

    // Increment index for the *next* iteration
    readIndex++;

     // Optional: Add extra delay after sentences ending with a period
     if (chunk.sentenceEnd && readInterval) {
         // Temporarily stop and restart with a delay
         // Note: This simple approach adds delay *after* the word.
         // More complex logic could adjust the *next* interval.
         window.clearInterval(readInterval);
         var interval = 60000 / prefs.speed;
         // Add extra time, e.g., half the normal interval
         setTimeout(start, interval * 0.5);
     }
}


/**
 * Saves user preferences to localStorage.
 */
function savePrefs() {
    try {
        localStorage.setItem('prefs', JSON.stringify(prefs));
    } catch (e) {
        console.error("Could not save preferences to localStorage:", e);
    }
}

// --- Document Ready ---
$(document).ready(function() {
    // Load preferences from localStorage or use defaults
    try {
        var storedPrefs = localStorage.getItem('prefs');
        if (storedPrefs) {
            prefs = JSON.parse(storedPrefs);
        }
    } catch (e) {
        console.error("Could not load preferences from localStorage:", e);
        // Use default prefs if loading fails
        prefs = { speed: 200, night: false, merge: true };
    }

    // Apply loaded preferences to UI elements
    $('#reading-speed').val(prefs.speed);
    if (prefs.night === true) {
        $('body').addClass('night');
        $('#night-mode').prop('checked', true); // Use prop for checkboxes
    }
    if (prefs.merge === false) {
        $('#merge').prop('checked', false); // Use prop for checkboxes
    }

    // Initialize body data attributes
    $('body').data({ 'reading': false, 'prepared': false });

    // Prepare the initial text in the textarea
    prepare($('#text-to-read').val());
    updateProgressDisplay(0, preparedChunks.length); // Show initial progress 0 / total

    // --- Event Handlers ---

    // Start/Pause button
    $('#start').on('click', function() {
        var data = $('body').data();
        if (data.reading === false) { // If currently stopped/paused
            // If text hasn't been prepared (e.g., user cleared textarea), prepare it now
            if (data.prepared === false) {
                var text = $('#text-to-read').val();
                prefs.speed = parseInt($('#reading-speed').val()) || 200; // Ensure speed is valid
                 if (text.length > 0 && prefs.speed > 0) {
                    prepare(text);
                } else {
                    // Optionally provide feedback if no text/speed
                    // alert('No text to read or invalid speed.');
                    return; // Don't proceed if no text
                }
            }

             // Ensure readIndex is valid before starting
             if (readIndex >= preparedChunks.length) {
                 readIndex = 0; // Reset if at the end
             }

            // Transition UI: Hide text area, show reading screen
            $('#text-to-read').fadeOut(250, function() {
                $('#reading-screen, #new, #text-progress').fadeIn(250); // Show progress bar too
                start(); // Start the reading interval
            });
            $('h1').animate({ height: 0, opacity: 0 }, 500); // Hide title
            $('#other').fadeOut(500); // Hide instructions
            // Disable merge checkbox during reading
            $('#merge').prop('disabled', true).parent().css('opacity', 0.5);
        } else { // If currently reading
            stop(); // Pause the reading
        }
    });

    // Update preparation when text area changes
    $('#text-to-read').on('input', function() { // Use 'input' for immediate feedback
        readIndex = 0; // Reset index when text changes
        prepare($(this).val());
        $('body').data('prepared', false); // Mark as unprepared until 'Read!' is clicked again
        updateProgressDisplay(readIndex, preparedChunks.length); // Update display
        $('#text-progress').val(readIndex); // Reset progress bar value
    });

    // Update speed preference and restart reading if active
    $('#reading-speed').on('change', function() {
        var newSpeed = parseInt($(this).val());
        // Basic validation for speed
        if (newSpeed > 0 && newSpeed <= 2000) { // Set a reasonable max speed
             prefs.speed = newSpeed;
             savePrefs();
             if ($('body').data('reading') === true) {
                 stop();
                 start(); // Restart with new speed
             }
        } else {
            // Reset to previous valid speed if input is invalid
            $(this).val(prefs.speed);
        }
    });

    // Handle progress bar interaction
    $('#text-progress').on('mousedown touchstart', function() {
        // Pause reading if active when user interacts with slider
        if ($('body').data('reading') === true) {
            stop();
            $('body').data('reading', 'paused'); // Set paused state
        }
        // Update word display while dragging
        $(this).on('input mousemove touchmove', function() { // 'input' event works well for range sliders
            var newIndex = parseInt($(this).val()) - 1; // Get 0-based index
            if (newIndex >= 0 && newIndex < preparedChunks.length) {
                 $('#word').html(preparedChunks[newIndex].text);
                 // Re-typeset if it's a MathJax chunk
                 if (preparedChunks[newIndex].text.includes('$')) {
                     try {
                         MathJax.typesetPromise([document.getElementById('word')]).catch(console.error);
                     } catch (err) { console.error(err); }
                 }
                 updateProgressDisplay(newIndex + 1, preparedChunks.length); // Update number display
            }
        });
    }).on('mouseup touchend', function() {
        // Set readIndex to the slider's final position
        // Subtract 1 because slider value is 1-based for display, readIndex is 0-based
        readIndex = parseInt($(this).val());
        // Ensure index is within bounds
         if (readIndex < 0) readIndex = 0;
         // If index is exactly length, it means user dragged to end, keep it there to signify completion
         if (readIndex > preparedChunks.length) readIndex = preparedChunks.length;


        // Update the display one last time based on final slider position
        var displayIndex = readIndex > 0 ? readIndex : 0; // Show 0 if at start
        var wordIndex = displayIndex > 0 ? displayIndex -1 : 0; // Get index for array access

        if(preparedChunks.length > 0 && wordIndex < preparedChunks.length) {
            $('#word').html(preparedChunks[wordIndex].text);
             if (preparedChunks[wordIndex].text.includes('$')) {
                 try {
                     MathJax.typesetPromise([document.getElementById('word')]).catch(console.error);
                 } catch (err) { console.error(err); }
             }
        } else if (preparedChunks.length === 0) {
             $('#word').html(''); // Clear word display if no text
        }
         updateProgressDisplay(displayIndex, preparedChunks.length);


        $(this).off('input mousemove touchmove'); // Stop listening to drag events
        // Resume reading if it was paused by interaction
        if ($('body').data('reading') === 'paused') {
            start();
        }
    });


    // 'New text' button: Show text area, hide reading screen
    $('#new').on('click', function() {
        $('#reading-screen, #text-progress').hide(); // Hide progress bar too
        $('#text-to-read, #other').fadeIn(500);
        $('h1').animate({ height: '26px', opacity: 1 }, 500); // Restore title
        $(this).fadeOut(500); // Hide 'New text' button
        $('#merge').prop('disabled', false).parent().css('opacity', 1); // Re-enable merge checkbox
        if ($('body').data('reading') !== false) { // If reading or paused
            stop();
        }
        readIndex = 0; // Reset index
        $('body').data('prepared', false); // Mark as unprepared
        updateProgressDisplay(0, preparedChunks.length); // Reset progress display
        $('#text-progress').val(0); // Reset progress bar value
        $('#word').html(''); // Clear the word display area
    });

    // Night mode toggle
    $('#night-mode').on('change', function() {
        if ($(this).is(':checked')) {
            $('body').addClass('night');
            prefs.night = true;
        } else {
            $('body').removeClass('night');
            prefs.night = false;
        }
        savePrefs();
    });

    // Merge short words toggle
    $('#merge').on('change', function() {
        prefs.merge = $(this).is(':checked');
        savePrefs();
        // Re-prepare the text immediately if merge preference changes
        // This ensures the chunk count and progress bar reflect the new setting
        prepare($('#text-to-read').val());
        readIndex = 0; // Reset index after re-preparing
        updateProgressDisplay(0, preparedChunks.length); // Update display
        $('#text-progress').val(0); // Reset progress bar value
    });

    // Keyboard shortcuts
    $('body').on('keyup', function(e) {
        // Ignore shortcuts if textarea has focus
        if ($('#text-to-read').is(':focus') || $('#reading-speed').is(':focus')) {
            return;
        }

        var readingState = $('body').data('reading');

        if (e.keyCode == 80 || e.keyCode == 32) { // P or Spacebar
            e.preventDefault(); // Prevent spacebar scrolling
             // Only toggle play/pause if the reading screen is visible
             if ($('#reading-screen').is(':visible')) {
                 if (readingState === true) {
                    stop();
                 } else {
                    start();
                 }
             }
        } else if (e.keyCode == 39) { // Right arrow
            // Increase speed
            $('#reading-speed').val(prefs.speed + 25).trigger('change');
        } else if (e.keyCode == 37) { // Left arrow
            // Decrease speed
            $('#reading-speed').val(prefs.speed - 25).trigger('change');
        } else if (e.keyCode == 66) { // B key
             // Go back 10 words (only if reading screen is visible)
             if ($('#reading-screen').is(':visible')) {
                 var wasReading = (readingState === true);
                 if(wasReading) stop(); // Pause if readin

                 readIndex = Math.max(0, readIndex - 10); // Go back max 10, don't go below 0

                 // Update display immediately
                 if (preparedChunks.length > 0 && readIndex < preparedChunks.length) {
                     $('#word').html(preparedChunks[readIndex].text);
                      if (preparedChunks[readIndex].text.includes('$')) {
                          try {
                              MathJax.typesetPromise([document.getElementById('word')]).catch(console.error);
                          } catch (err) { console.error(err); }
                      }
                     updateProgressDisplay(readIndex + 1, preparedChunks.length);
                     $('#text-progress').val(readIndex + 1);
                 } else {
                     // Handle edge case if index is 0 or chunks are empty
                     $('#word').html(preparedChunks.length > 0 ? preparedChunks[0].text : '');
                     updateProgressDisplay(preparedChunks.length > 0 ? 1 : 0, preparedChunks.length);
                     $('#text-progress').val(preparedChunks.length > 0 ? 1 : 0);
                 }

                 if(wasReading) start(); // Resume if was reading
             }
        }
    });
});
