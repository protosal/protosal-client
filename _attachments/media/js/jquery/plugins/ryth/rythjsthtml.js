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
    $.fn.jsthtml = function() {

        
           return $(this).html().replace(/<jst>/gi, "<script>").replace(/<\/jst>/gi, "<\/script>");
        

    };



})(jQuery);
