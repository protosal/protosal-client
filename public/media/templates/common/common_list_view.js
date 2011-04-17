common_list_view =  Backbone.View.extend({
    
    initialize: function( options ){
        this.renderView( "#contentpane", "#common_list_view_template", options );
        header_options = {
            'title': _(GLOBALS.controller).capitalize() + ' List',
            'buttons': [{
                            'text': 'New ' + _(GLOBALS.controller).capitalize(),
                            'href': '#/' + GLOBALS.controller + '/edit',
                            'classes': 'addbutton'
                }
            ]
            
        }
        // Custom buttons for a proposal list
        if( options.controller == "proposal" ){
            header_options.buttons.push({
                'text': 'New Template',
                            'href': '#/' + GLOBALS.controller + '/edit/template',
                            'classes': 'addbutton'
            });
            header_options.buttons.push({
                'text': 'View Templates',
                            'href': '',
                            'classes': 'switchToTemplates findbutton ui-state-attention'
            });
        }
            
        setTimeout( function (){     $(".dataTables_filter input").focus(); }, 400);
        $(".dataTables_filter input").focusout( function(){
            setTimeout( function (){ $(".dataTables_filter input").focus(); }, 700);
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
                options.rows = rows;
                // Show Use Template Button if proposal templates
                options.templateButton = false;
                if( listview.templatesActive ){
                    options.templateButton = true;
                }
                // Initialize the table view for the list
                new common_list_view_table( options );
                  setTimeout( function (){     $(".dataTables_filter input").focus(); }, 400);
        $(".dataTables_filter input").focusout( function(){
            setTimeout( function (){ $(".dataTables_filter input").focus(); }, 700);
        });
                  
                $("#common_list_view_table_container").fadeIn(400);
            }
        });
        
        ListView = Backbone.View.extend({
            templatesActive: false,
            el: $("#common_list_view_container"),
            initialize: function () {
                
                $("#pageheader").html( _.template( $("#page_header_template").jsthtml(), header_options ) );
                
                if( options.controller == "proposal" ){
                    couch_view = "list_by_author/";
                } else {
                    couch_view = "list_by_author_templates/";
                }
                var url = GLOBALS.server_base + couch_view + GLOBALS.controller;
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
                "click .switchToTemplates": "switchToTemplates",
                "click .usetemplate": "useTemplate"
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
                
            },
            switchToTemplates: function( event ){
                var button = $(".ui-button-text", $(event.currentTarget));
                var that = this;
                if( !that.templatesActive ) { 
                var url = GLOBALS.server_base + "list_by_author_templates/" + GLOBALS.controller;
                $.ajax( url, {
                    dataType: "json",
                    success: function(data){
                        console.log("got data")
                        listdata.refresh(data);
                    }
                
                });
                that.templatesActive = true;
                $(button).text("Back to Proposals");
            }   else {
                    var url = GLOBALS.server_base + "list_by_author/" + GLOBALS.controller;
                $.ajax( url, {
                    dataType: "json",
                    success: function(data){
                        console.log("got data")
                        listdata.refresh(data);
                    }
                
                });
                that.templatesActive = false;
                $(button).text("View Templates");
            }
                return false;
            },
            useTemplate: function( event ){
                
                var id = $(event.currentTarget).parents("tr").attr("row_id");
                $.ajax({
                    url: GLOBALS.server_base + "data/newinstance/" + id,
                    dataType: "json",
                    success: function( data ) {
                        redirect("proposal/edit/"+data._id);
                    }
                });
                return false;
            }
            
        });
        var listdata = new ListData;
        var listview = new ListView;

}
});
