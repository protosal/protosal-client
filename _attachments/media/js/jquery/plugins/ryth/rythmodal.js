/*
 * A jQuery plugin template
 * Basically used as personal reference
 * 
 * Author: Andy Goh (hantu)
 * Website: http://www.andygoh.net
 *
 * Revisions:
 *		0.1		- Initial commit
 * 
 * References:
 *		http://www.learningjquery.com/2007/10/a-plugin-development-pattern
 *		http://docs.jquery.com/Plugins/Authoring
 *
 * Notes:
 *		- Good idea to name your file jquery.pluginName.js
 */
 
(function($) {

	// replace 'pluginName' with the name of your plugin
    $.fn.rythmodal = function(options) {
		// plugin default options
        var defaults = {
        };

		// extends defaults with options provided
        if (options) {
			$.extend(defaults, options);
		}
        
		// iterate over matched elements
        return this.each(function() {   
            $(this).click(function() {
                // Store a reference to the modal button to be used
                // in the close callback.
                var modal_button = $(this);
                if (!$(this).button("option", "disabled")) {
                    modalpane = "#" + $(this).attr("pane");
                    // Disable the button while the modal is visible
                    $(this).button("option", "disabled", true);
                    
                    $( modalpane ).dialog( { 
                        position: ['center', 200], 
                        modal: true,
                        draggable: false,
                        width: 500,
                        dialogClass: 'modal2',
                        hide: 'drop',
                        // Reset all form inputs when modal popup is closed
                        // TODO: Remove QTips on modal popup close
                        beforeClose: function(event, ui) {
                            $(".qtip").qtip("destroy");
                            $('form', $( modalpane )).each( function() {
                                $(this).get(0).reset();   
                            });
                        },
                        close: function(event, ui) {
                            // Re-enable the button once the modal has fully closed.
                            $( modal_button ).button("option", "disabled", false);
                        }
                    });
                }
                return false;   
            })
        
       
        });

    };



	// private functions definition
	function foobar() {}

})(jQuery);
