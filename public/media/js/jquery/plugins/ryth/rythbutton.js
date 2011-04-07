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
    $.fn.rythbutton = function(options) {
		// plugin default options
        var defaults = {
        };

		// extends defaults with options provided
        if (options) {
			$.extend(defaults, options);
		}

		// iterate over matched elements
        return this.each(function() {
            $(this).button();
			$(".addbutton").button({ icons: { primary: 'ui-icon-plusthick',	}});
			$(".addbutton").button({ icons: { primary: 'ui-icon-plusthick',	}});
			$(".findbutton").button({ icons:{ primary: "ui-icon-circle-zoomin" } } );
        });

    };



})(jQuery);
