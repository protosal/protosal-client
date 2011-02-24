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
    $.fn.rytheditable = function(options) {
		// plugin default options
        var defaults = {
        };

		// extends defaults with options provided
        if (options) {
			$.extend(defaults, options);
		}

		// iterate over matched elements
        return this.each(function() {
                 $(this).editable( BASE_URL + '/inline/edit', {
                                        "submitdata": function ( value, settings ) {
                                            oldfield = value;
                                            return {
                                                 "model": $(dataTable).attr("model"),
                                                 "id": $(this).parent().attr("id"),
                                                 "field": $("thead th:nth-child("+ (($(this).parent().children().index($(this)))+1) +")", dataTable).attr("field")
                                            };
                                        },
                                            width: "none",    
                                        callback : function(value, settings) {
                                            // Get the position of the element we modified.
                                            var aPos = dataTable.fnGetPosition( this );
        
                                            // Recreate the filters using the latest dat
                                            var column_index = (($(this).parent().children().index($(this))));
                                            obj = $("thead th:nth-child(" + (column_index + 1) + ") input[type=checkbox]", dataTable);
                                            $(obj).each( function() {
                                                if ($(this).val() == oldfield) {
                                                    $(this).val(value);
                                                    $("p", $(this).parent()).text(value);
                                                    update_filters($(this).parents("th"), column_index);
                                                }
                                            });

                                            // Update the internal representation of the datatable.
                                            dataTable.fnUpdate( value, aPos[0], aPos[1] );
                                        }
                                     
                                    });
        });

    };

	// public functions definition
	$.fn.rytheditable.functionName = function(foo) {
		return this;
	};

	// private functions definition
	function foobar() {}

})(jQuery);
