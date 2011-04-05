common_list_view_table = Backbone.View.extend({
    
    initialize: function( options ){
        this.renderView( "#common_list_view_table_container",  "#common_list_view_table_template", options );
        
        $(".list_view").dataTable({
                          
            "aaSorting": [],
            "iDisplayLength": 250,
            "oLanguage": {
                //"sSearch": "Search<img src='/media/icons/Misc-Search-icon.png' style='margin-top: -5px; margin-right: 10px; float: left; width: 28px;' />",
                "sSearch": "Search<img src='/media/icons/Misc-Search-icon.png' style='position: absolute; top: -5px; width: 27px; right: 630px;' />",
                "sLengthMenu" : "Show _MENU_"
            },
            "bJQueryUI": true,
            "sDom": 'frti',
            "bAutoWidth": false
        });
}
});
