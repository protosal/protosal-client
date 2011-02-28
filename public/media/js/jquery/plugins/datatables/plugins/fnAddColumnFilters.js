// Dependencies fnGetColumnData.js

$.fn.dataTableExt.oApi.fnAddColumnFilters = function ( oSettings )
{
    function fnCreateSelect( aData )
    {
        var r = "<div class='datatable-filter-dialog ui-dialog ui-widget ui-widget-content ui-corner-all' style='width: 400px;'>";
        
        r += '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix">';
        r += '    <p id="ui-dialog-title-dialog" style="text-align:right" class="ui-dialog-title">Filter</p>';
        r += '    ';
        r += '</div>';
        r += '<div style=";" class="ui-dialog-content ui-widget-content" >';
        r += '<ul class="datatable-filter">';
        var iLen = aData.length;
        for ( var i = 0 ; i < iLen ; i++ )
        {
            r += '<li><input type="checkbox" value="'+aData[i]+'" /><p>'+aData[i]+'</p></li>';
        }
        return r + '</ul><div style="clear:both;"></div></div>';
    }
    
    var update_filters = function(ref, column_index) {
        var regex_filter = ""
        $(":checked", $(ref)).each( function() {
            regex_filter += ""+$(this).val()+"|";
        })
        regex_filter = regex_filter.replace(/\s/g, ".");

        dataTable.fnFilter(regex_filter.substr(0,regex_filter.length-1), column_index, true);
    }
    
    dTable = this;
    $(".dataTables_wrapper thead:first th", this).each( function ( i ) {
        var dropdown_filter_html = fnCreateSelect( dTable.fnGetColumnData(i, true, false, true) );
        // Add the filters to the datatable headers
        $(".datatable-filter-container", $(this)).append(dropdown_filter_html);
         
        $('input[type=checkbox]', $(this)).click( function () {
            update_filters($(this).parents("th"), i);
            event.stopPropagation();
        } );
    } );
    
    /* Stop propogation of filter dialog events created above */
    $(".datatable-filter-dialog").click( function(){
        $(this).toggle();
        return false;
    });
}
