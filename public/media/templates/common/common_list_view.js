common_list_view =  Backbone.View.extend({
    
    initialize: function( options ){
        this.renderView( "#contentpane", "#common_list_view_template", options );
        options = {
            'title': _(GLOBALS.controller).capitalize() + ' List',
            'buttons': [{
                            'text': 'New ' + _(GLOBALS.controller).capitalize(),
                            'href': '#/' + GLOBALS.controller + '/edit',
                            'classes': 'addbutton'
                },
            ]
            
        }
        

        
        setTimeout( function (){     $(".dataTables_filter input").focus(); }, 400);
        $(".dataTables_filter input").focusout( function(){
            setTimeout( function (){     $(".dataTables_filter input").focus(); }, 700);
        });

        ListData = Backbone.Collection.extend({
            model: window.Document,
            initialize: function (){
                this.bind( "refresh", this.renderTable );
                this.url = "data";
            },
            renderTable: function(){
                $("#common_list_view_table_container").hide();
                if( this.models.length != 0 ) {
                    rows = this.models;
                  
                } else {
                    rows = [];
                   
                }
                options = { rows: rows };
                
                // Initialize the table view for the list
                new common_list_view_table( options );
                  
                  
                $("#common_list_view_table_container").fadeIn(400);
            },
        });
        
        ListView = Backbone.View.extend({
            el: $("#common_list_view_container"),
            initialize: function () {
                
                $("#pageheader").html( _.template( $("#page_header_template").jsthtml(), options ) );
                
                
                var url = GLOBALS.server_base + "/list_by_author_templates/" + GLOBALS.controller;
                $.ajax( url, {
                    dataType: "json",
                    success: function(data){
                        console.log("got data")
                        listdata.refresh(data);
                    }
                
                });
                
            },
            events: {
                "click .delete":  "removeRow",
                "click .edit":  "editPage",
            },
            removeRow: function(event){
                if( confirm("Are you sure you want to delete this?") ){
                    var row = $(event.currentTarget).parents("tr");
                    var id = row.attr("row_id");
                    row.remove();
                    listdata.get(id).destroy();
                }
            },
            editPage: function(event){
                var row = $(event.currentTarget).parents("tr");
                var id = row.attr("row_id");
                redirect( GLOBALS.controller + "/edit/" + id );
                
            }
        });
        var listdata = new ListData;
        var listview = new ListView;

}
});
