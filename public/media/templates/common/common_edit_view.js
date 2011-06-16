// ## Common Edit View
// The common edit view is a way to abstract a lot of re used code on pages that edit sections of data.   At the moment it is currently implemented for proposal, section, fee, client and settings essentially being the current gateway for ALL editions
// Extend Backbone.View
common_edit_view = Backbone.View.extend({
    initialize: function(options) {
        // Render edit pages into the main content pane
        this.renderView( options.targetPane, "#common_edit_view_template", options);

        // If there is no default success handler, always redirect back to the list of entities you were currently editing
        if (typeof options.success == "undefined") {
            options.success = function() {
                redirect(GLOBALS.controller + "/list");
            }
        }

        // If what you are editing is not a template we have to explicitly set it to empty
        if (typeof options.templateid == "undefined") {
            options.templateid = "";
        }

        // We have to decide what the current document id is, when editing pages with modals you have to make sure you use the passed documentid and no the route id . TODO
        if (typeof options.documentid == "undefined") {
            options.current_doc_id = "";

            if (GLOBALS.controller == options.controller) {
                options.current_doc_id = GLOBALS.route_id;
            }

        } else {
            options.current_doc_id = options.documentid;
        }

        // _No idea what this does_ - TODO
        _rev = ""

        // ## The Edit Form View
        // Create the edit view which is responsible for loading in the correct form into the correct container.
        EditView = Backbone.View.extend({

            // All forms have a naming convention for where they are placed
            el: $("#" + options.controller + "_edit_view_container"),

            initialize: function( options ) {

                // Set a bunch of messy variables to generate the appropiate header buttons
                exitAction = "Back";
                exitActionClass = "back-button";
                if (options.modal == "yes") {
                    exitAction = "Close";
                    exitActionClass = "close-button";

                }
                header_options = {
                    'title': _(options.controller).capitalize() + ' Edit',
                    'buttons': [{
                        'text': 'Save',
                        'classes': options.controller + '_save',
                        'controller': options.controller},
                    {
                        'text': exitAction,
                        'classes': exitActionClass}
/*<% if( typeof buttons != "undefined" ){ _.each( buttons, function(button){  %>
                            ,{
                                        'text': '<%= button.text %>',
                                        'classes': '<%= button.class %>'
                            }
                        <% })} %>*/

                                            ]

                }
                // Append the header for this page
                    _.jstTemplate($("#" + options.controller + "_pageheader"), $("#page_header_template"), header_options);


                // If an id is present we are editing a document, if the id is null we are creating a new object.   _Note: For the settings page a bit of hackery goes on in the nested else statement_
                id = options.current_doc_id;
                templateid = options.templateid;
                if (id && id != "template") {
                    // Do an ajax call to bring down any data associated with the document id
                    var url = GLOBALS.server_base + "data/" + id;
                    $.ajax(url, {
                        dataType: "json",
                        success: function(data) {
                            // Once the data has successfully been brought down, initialize the form view and run ckeditor.
                            data.success = options.success;
                            data.documentid = options.current_doc_id;
                            data.controller = options.controller;
                            
                            var edit_options = data;
                            new window[ options.controller + "_form_view"]( edit_options );

                            cked = "";
                            setTimeout(function() {
                                cked = ($(".jckeditor", $("#" + options.controller + "_formc")));
                                cked.ckeditor(ckeditor_options);
                            }, 200);

                            if (typeof data._rev != "undefined") _rev = data._rev;
                            // Attach a configured click handler to the save button. See index.js for the saveclickHandler
                            if( data.template == false ){
                                templateid = "a";
                            }
                            $("." + options.controller + "_save").click({
                                _rev: _rev,
                                _id: id,
                                templateid: templateid,
                                success: options.success
                            }, window.saveclickHandler);
                        }
                    });
                } else if (options.controller == "user") {
                    // Bit of magicerky going on here, fix it up later.
                    var url = GLOBALS.server_base + 'user';
                    $.ajax(url, {
                        dataType: "json",
                        success: function(data) {
                            
                            var edit_options = data;
                            new window[ options.controller + "_form_view"]( edit_options );
                        }
                    });
                } else {
                    // If this is a new document we have to configured the save button to operate differently.   Load in the template with no pre filled data.
                    
                    $("." + options.controller + "_save").click({
                        _rev: "",
                        _id: "",
                        templateid: "",
                        documentid: "",
                        success: options.success
                    }, window.saveclickHandler);
                    
                    var edit_options = {
                        controller: options.controller,
                        success: options.success,
                        documentid: ""
                    };

                    // Depending on what controller was specified instantiate the form view
                    new window[ options.controller + "_form_view"]( edit_options );
                    
                    
                    cked = "";
                    setTimeout(function() {
                        cked = ($(".jckeditor", $("#" + options.controller + "_formc")));
                        cked.ckeditor(ckeditor_options);
                    }, 200);
                    setTimeout(function() {
                        $("input:first").focus();
                    }, 400);

                }


        GLOBALS["autosave"+options.controller] = setInterval( function(){
    $("." + options.controller + "_save").trigger("click", [true]);
                    }, 60000 );
            }

        });

        // Trigger initialization of the EditView
        editview = new EditView( options );

    }
});
