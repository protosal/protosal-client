cked = "";
        function killck(){
                                    if( cked != "" ){
                            cked.ckeditor(function(){ // a hack to make jck editor work on page refresh
                            
                                this.destroy();
                            });
                        }
        }
        var GLOBALS = {
            "route_id": null,
            "controller": null,
            "action": null,
            "server_base": window.location.protocol + "//" + window.location.host,
            "session": false,
        };
        ckeditor_options = {  
                toolbar: [
                    ['Bold', 'Italic', '-', 'NumberedList', 'BulletedList', '-', 'Link', 'Unlink','-','About'],['Styles','Format','Font','FontSize'],
                    ['TextColor','BGColor'],
                    ['Maximize', 'ShowBlocks','-','About','Source']
                ]
            };
        if(window.location.pathname != "/") window.location = "/"; //handles 404 errors
        
        // Dynamically load CSS files.
        $script([
            'http://ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.js',
            '/media/js/underscore.js',
            '/media/js/backbone.js'
            ],function(){
                $script([
                '/media/js/jquery/plugins/ryth/rythjsthtml.js',
                '/media/js/common.js',
                '/media/js/jquery.corner.js',
                'https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.9/jquery-ui.min.js',
                '/media/js/jgrowl.min.js',
                '/media/js/jquery/plugins/ryth/rythbutton.js',
                '/media/js/jquery.dataTables.js',
               	'/media/js/backbone_extensions.js'
                ],
            // Load functions sequentially for fun, might just scratch this off
             function(){
             	$script(['/media/templates/all.js'],
             	 function(){
		            loadMain();
		            $script([
		                '/media/highchart/js/highcharts.js',
		                '/media/ckeditor/ckeditor.js',
		                '/media/js/jquery.json-2.2.min.js',
		                '/media/js/jquery.defaultvalue.js',
		            ], function(){ 
		                $script('/media/ckeditor/adapters/jquery.js', function(){})
        })
        })
        })
        });
        
       function loadMain() {
            console.log("Head.js has finished loading");
            
			// Now this function loads the main code
     

            
            d = new Date();
            $.ajax({ 
                url: "media/templates/all.html?" +   d.getTime(),
                success: function(response){
                        $("body").append(response);
                        
                         $.ajaxPrefilter(function( options ) {
                          
                           options.error = function(data){
                                if( typeof $.parseJSON( data.responseText ).redirect != "undefined" ) {
                                    redirect( $.parseJSON( data.responseText ).redirect );
                                }
                           }
                        });
                        var url = GLOBALS.server_base + "/user";
                        $.ajax( url, {
                            dataType: "json",
                            complete: function(headers, data, data2){
                                if( headers.status != 401 ){
                                    GLOBALS.session = true;
                                    console.log("User already logged in");
                                    
                                    body = $.parseJSON( headers.responseText );
                                    GLOBALS.username = body._id.replace("org.couchdb.user:", "");
                                }
                                    $.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
                                        errorMessages = {
                                            "already registered": "This username has already been taken",
                                            "incorrect credentials": "Invalid username/password, try again or reset your password",
                                            "not activated": "You have not activated your account yet, please check your email inbox",
                                            "user not found": "No user exist with this email address"
                                        };
                                        jqXHR.error (function(response) {
                                            var reason = $.parseJSON(response.responseText).reason;
                                            if( typeof errorMessages[reason] != "undefined") {
                                                $.jGrowl( errorMessages[reason] ,{  theme: 'apple', position: "top-right"});    
                                            } else{
                                                $.jGrowl("Something went wrong! Refresh the page if it continues to happen",{  theme: 'apple', position: "top-right"});   
                                            }
                                            
                                        });
                                    });
                                    protosal_controller = new ProtosalController;
                                    Backbone.history.start();
                                    
                            }
                        
                        });
                        
                        
                       
            
                     
                }
            });
            
            var ProtosalController = Backbone.Controller.extend({
            
              routes: {
                "/:controller/:action":                 "defaultRoute",
                "/:controller/:action/:vid":                 "defaultRoute",
                "/logout":                 "logout",
                "":                                     "landingPage",
              },
                logout: function(){
                
                    $.ajax({
                        url: "/logout",
                        dataType: "json",
                        success: function(data){
                            GLOBALS.session = false;
                            redirect( "dashboard/login" );
                        }
                    });
                },
                landingPage: function(){
                  window.location = "#/dashboard/login"
                },
              defaultRoute: function(controller, action, vid) {
                    /* Redirect people to the home page if they try
                       to access the login page when they are already
                       authenticated.
                    */
                    if(typeof CKEDITOR != "undefined" ){
                        delete CKEDITOR.instances.description;
                    }
                    if( GLOBALS.session && controller == "dashboard" && action == "login" ) {
                        redirect("dashboard/home");
                        return;
                    }

                    if( GLOBALS.session || action == "login") {
                        if( vid == null) vid = "";
                        GLOBALS.controller = controller;
                        GLOBALS.action = action;
                        GLOBALS.route_id = vid;

                        $('.maintabs li').removeClass('ui-state-active').removeClass('ui-tabs-selected'); //Make all tabs inactive
                        $("#" + GLOBALS.controller).addClass('ui-state-active').addClass('ui-tabs-selected');
                        $("#contentpane div").fadeOut(300);
                        //get URL for the ajax call
                        url = GLOBALS.server_base + "/api/get" + location.hash.substr(1) + "/" + GLOBALS.route_id; 
                        
                        //We know the page is about to change so lets clean up any jckeditors hanging around before the dom changes and jckeditors internal reference is updated
                        //CLEAN UP EVERYTHING
                        

                        $(".ui-dialog").remove();
                        $(".modal_window").remove();
                        $(".proposal_preview_container").remove();
                        
                        var obj = {};
                        template = GLOBALS.controller + "_" + GLOBALS.action + "_view";

                        
                        var template_name = "";
                        obj.username= GLOBALS.username;
                        obj.controller = GLOBALS.controller;
                        obj.action = GLOBALS.action;
                        if ( GLOBALS.action == "list" ) {
                            template_name = "common_list";
                        } else if( GLOBALS.action == "edit" ) {
                            template_name = "common_edit";
                        } else {
                            template_name = GLOBALS.controller + "_" + GLOBALS.action
                            $("#contentpane").hide();
                        }
                        if( GLOBALS.controller + GLOBALS.action == "proposaledit"){
                            $(".footer").hide();
                            $(".maincontainer").css("position", "fixed");
                            $(".containerspace").show();
                        } else {
                            $(".footer").show();
                            $(".maincontainer").css("position", "absolute");
                            $(".proposalcontainer").remove();
                            $(".containerspace").hide();
                        }
                        
                        
                        
                       $("#contentpane").fadeIn(300);
                       var options = obj; // future naming convention for passing options to views
                       options.targetPane = "#contentpane";
                       var current_view = new window[template_name + "_view"]( options );
                       
                    } else {
                        redirect("dashboard/login");
                    }
              }, //end of DEFAULT ROUTE

            });
            
            $(".back-button").live("click", function() { history.go(-1); return false;  });
            $(".close-button").live("click", function(event) { console.log(event); $(event.currentTarget).parents(".ui-dialog-content").dialog("close"); return false; });
            window.saveclickHandler =  function(event){

                var formdata = null;

                //Serialize the form associated with the save button
                savebutton = event.currentTarget;
                savebuttoncontroller = $(savebutton).attr("controller");
                formdata = $(".edit_" + savebuttoncontroller + "_form").serializeObject();

                if( typeof formdata.feelist != "undefined" ) {
                    formdata.feelist = formdata.feelist.split(",");
                } else if( typeof formdata.sectionlist != "undefined" ) {
                    formdata.sectionlist = formdata.sectionlist.split(",");
                }
                
                formdata.type = savebuttoncontroller;
                if(event.data.templateid == "") {
                    formdata.template    = true;
                }
                var url = GLOBALS.server_base + "/data";
                type = "POST";
                
                // Detect if we are inserting (POST), or updating (PUT)
                // based on whether an id is supplied.
                // NB: This is only our convention, as you can insert
                // into CouchDB with PUT.
                if( typeof event.data._id != "undefined" && event.data._id != "" ) {
                    url += "/" + event.data._id; 
                    if(  event.data._rev != "" ) {
                        formdata._rev = event.data._rev;
                    }
                    type = "PUT";
                }
               
                // Do the request and on success call custom success function
                $.ajax( url, {
                    dataType: "json",
                    type: type,
                    contentType: "application/json",
                    data: $.toJSON(formdata),
                    success: function(data){
                        _.extend( data, formdata );
						console.log(event.data.success)
                        event.data.success(data);
                    }
                });
                
                return false;
            };
            
            window.Document = Backbone.Model.extend({
                url: function(){
                    var base = "data";
                    if (this.isNew()) return base;
                    rev = '';
                    if( typeof this.get("value")._rev != "undefined" ) {
                        rev = "/" + this.get("value")._rev;
                    } else {
                        rev = '';
                    }
                    return base + (base.charAt(base.length - 1) == '/' ? '' : '/') + this.id + rev;
                }
            });
              
            $(".view_variables").live("click", function(){
                $("<div>").html($("#view_variables").jsthtml()).dialog({
                    draggable: false,
                    resizable: false,
                    closeOnEscape: true,
                    modal: true, 
                    hide: 'drop',
                    width: "960px",
                    position: ["50%",100],
                    height: "500"
                });
                return false;
            });
            $(".preview_buttons button").button();   
            $(".variables_close").button();          
        };
        