var partials = {
                "section_edit_view": [ "section_form" ],
                "fee_edit_view": [ "fee_form" ],
                "client_edit_view": [ "client_form" ]
            }
var pageOptions = { 
                       
                        success: function(data){
                        var obj = jQuery.parseJSON(data);
                         
                        
                            
                            template = GLOBALS.controller + "_" + GLOBALS.action + "_view";
                            if( partials[template]){
                               
                                _.each( partials[template], function( partial ) {
                                     partialname = partials[template] + "_partial";
                                     obj[partialname] =
                                        _.template( $("#" + partial    + "_template" ).jsthtml() );
                                        
                                   
                                })
                                
                            }
                            
                            var template_name = "";
                            
                            if ( GLOBALS.action == "list" ) {
                                template_name = "common_list";
                                obj.controller = GLOBALS.controller;
                                
                                // Hack so we can use square bracket notation in the template rather than eval()
                                var injected_obj = { obja : data.template_data}
                                obj = injected_obj.obja
                            } else {
                                template_name = GLOBALS.controller + "_" + GLOBALS.action
                            }
                           console.log(obj);
                            $("#contentpane").html( _.template( $("#" + template_name + "_view_template").html(), obj));
                            
                            $("#contentpane").html( $("#contentpane").jsthtml() );
                            
                            $(".tabs").tabs();
                                    // Apply the jQuery UI button widget to any buttons for cosmetic purposes
                                    $("button, .submit, .button, input[type=submit]").button();
                                    $(".addbutton").button({
                                                        icons: {
                                                            primary: 'ui-icon-plusthick',
                                                            //secondary: 'ui-icon-triangle-1-s'
                                                        }
                                                    });
                                    $(".wrenchbutton").button({ icons:{ primary: "ui-icon-wrench" } } );
                                    // Apply jQuery UI widget highlight and error to appropiate classes for cosmetic purposes
                                    $(".uihighlight").uihighlight();
                                    $(".uierror").uierror();
                                    $(".datatable_buttons").appendTo($(".toolbar"));
                                    //$(".dataTables_filter input").defaultValue({'value':"Search Filter"});
                                    //$("input#username").defaultValue({'value':"Company username"});
                                    //$("input#password").defaultValue({'value':"Company password"});
                                    
                                    
                                      
                                   // $("form").rythform();
                             // Parse the JSON response 
                             /*
                            var obj = jQuery.parseJSON(data);
                            if( obj != null ){
                                
                                gdata = obj.data;
                                
                                var data = obj.data;
                                if ( obj.data.redirect ) {
                                    redirect( obj.data.redirect ); 
                                } else if( obj.success ) {
                                    
                                   
                                    // If the JSON returned a succesful response, load the content into the #contentpane and re-apply jQuery methods
                                  
                                    //$("#contentpane").hide();
                                    
                                    if( data.template_data ) {
                                        
                                        template = GLOBALS.controller + "_" + GLOBALS.action + "_view";
                                        if( partials[template]){
                                           
                                            _.each( partials[template], function( partial ) {
                                                 partialname = partials[template] + "_partial";
                                                 data.template_data[partialname] =
                                                    _.template( $("#" + partial    + "_template" ).jsthtml() );
                                                    
                                               
                                            })
                                            
                                        }
                                        
                                        var template_name = "";
                                        
                                        if ( GLOBALS.action == "list" ) {
                                            template_name = "common_list";
                                            data.template_data.controller = GLOBALS.controller;
                                            
                                            // Hack so we can use square bracket notation in the template rather than eval()
                                            var injected_obj = { obj : data.template_data}
                                            data.template_data = injected_obj.obj
                                        } else {
                                            template_name = GLOBALS.controller + "_" + GLOBALS.action
                                        }
                                       
                                        $("#contentpane").html( _.template( $("#" + template_name + "_view_template").html(), data.template_data));
                                        
                                        $("#contentpane").html( $("#contentpane").jsthtml() );
                                         
										
                                       // alert($("#contentpane").html())
                                        //$("#contentpane").html( _.template( $("#thomasid").html(), data.template_data));
                                    } else {
                                        $("#contentpane").html(data.page);
                                    }
                                    
                                    //$("#contentcontainer").html(data.page);
                                   // $("#contentpane").fadeIn(100)
                                    // Apply the jQuery widget tabs to any HTML tab menus
                                    $(".tabs").tabs();
                                    // Apply the jQuery UI button widget to any buttons for cosmetic purposes
                                    $("button, .submit, .button, input[type=submit]").button();
                                    $(".addbutton").button({
                                                        icons: {
                                                            primary: 'ui-icon-plusthick',
                                                            //secondary: 'ui-icon-triangle-1-s'
                                                        }
                                                    });
                                    $(".wrenchbutton").button({ icons:{ primary: "ui-icon-wrench" } } );
                                    // Apply jQuery UI widget highlight and error to appropiate classes for cosmetic purposes
                                    $(".uihighlight").uihighlight();
                                    $(".uierror").uierror();
                                    $(".datatable_buttons").appendTo($(".toolbar"));
                                    //$(".dataTables_filter input").defaultValue({'value':"Search Filter"});
                                    //$("input#username").defaultValue({'value':"Company username"});
                                    //$("input#password").defaultValue({'value':"Company password"});
                                    
                                    
                                      
                                    $("form").rythform();
                     
                                    $(".jckeditor").each( function(){
                                        $(this).ckeditor(function() {}, {  
                                            toolbar: [
                                                ['Bold', 'Italic', '-', 'NumberedList', 'BulletedList', '-', 'Link', 'Unlink','-','About'],['Styles','Format','Font','FontSize'],
                                                ['TextColor','BGColor'],
                                                ['Maximize', 'ShowBlocks','-','About']
                                            ]
                                        });
                                    });
                                  
                                } else {
                                     // If the returned JSON object is null
                                    if ( data.redirect != null ) {
                                        window.location = "#/" + data.redirect;
                                    } else {
                                        window.location = "#error/missing";
                                    }
                                }
                            }
                            * */
                        },
                        // If no JSON is returned
                        error: function(e,msg){
                             $("#contentpane").html(e.responseText);
                             return false;
                        }

                    }; // end of pageOptions
