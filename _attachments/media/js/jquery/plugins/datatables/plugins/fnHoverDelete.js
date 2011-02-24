$.fn.dataTableExt.oApi.fnHoverDelete = function ( oSettings )
{
    $("tr", this).hover( function(){
        $("td:last", this).append("<div style='' class='datatable_delete_holder'><div style='' class='datatable_delete'><img src='" + BASE_URL + "/media/images/delete.png' class='datatable_delete_button'  /></div></div>");
        $(".datatable_delete",this).width($("td:last", this).width()+25);
        }, function() {
        $(".datatable_delete_holder", this).remove();
    });
}
