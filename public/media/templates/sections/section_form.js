section_form_view = Backbone.View.extend({
    initialize: function( options ){
    
    
        this.renderView("#section_formc", "#section_form_template", options);
    
  
        Fee = Backbone.Model.extend({
            //Create a model to hold friend atribute
            name: null
        });
        
        Fees = Backbone.Collection.extend({
          //This is our Friends collection and holds our Friend models
          initialize: function (models, options) {
            this.bind("add", options.view.addFee);
            this.bind("remove", options.view.removeFee);
            //Listen for new additions to the collection and call a view function if so
            
          }
        });
        //Make relationships !TODO
        cur_doc_id = options.documentid;
        SectionBackboneView = Backbone.View.extend({
            section_id: null,
            el: $("#section_form_container"),
            initialize: function () {
            that = this;
            section_backbone = this;
            
            //Create a section id at initialization so you can attach relationships straight away
            function aaaaaa(){
                if( GLOBALS.route_id == "" || (GLOBALS.controller != options.controller && options.documentid == "")){
                    formdata = $(".edit_section_form").serializeObject();
                    formdata.type = "section";
                       return $.ajax( "data", {
                            dataType: "json",
                            type: "POST",
                            contentType: "application/json",
                            data: $.toJSON(formdata),
                            success: function(resp){
								$('.section_save').unbind('click');
                                cur_doc_id = resp.id
                                $(".section_save").click({
                                    templateid: "",
                                    _rev: resp.rev,
                                    _id: resp.id,
                                    success: options.success 
                                }, window.saveclickHandler );
                                                    //We know the page is about to change so lets clean up any jckeditors hanging around before the dom changes and jckeditors internal reference is updated
                              
                                //redirect("section/edit/"+data.id);
                            }
                        });
                }  else {
                    return { id: options.documentid };
                }
            }
            $.when( aaaaaa() ).then( function(resp){
                that.section_id = resp.id;
                section_backbone.fees = new Fees( null, { view: section_backbone });
                console.log("lets get all the section fees that we have already added");
                    $.ajax({
                        url: "related2/section_fee/" + resp.id,
                        type: "GET",
                        dataType: "json",
                        success: function(data){
                            if( !data.error ){
                                if( data.length > 0 ){
                                    _.each( data, function( model ) {
                                        model = model.value;
                                        section_backbone.fees.add( {
                                            "id": model._id,
                                            "name": model.name,
                                            "price": model.price,
                                            "rev": model._rev,
                                            "preloaded": true
                                        } );
                                    });
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                                  
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                    
                                } else {
                                 console.log("no rows");
                                }
                         
                                  $.ajax({
                   type: "GET",
                   url: "list_by_author_templates/fee",
                   dataType: "json",
                   success: function( fees ){
                    
                    fees = _.map( fees, function( row ){
                        return {
                            "id" : row.value._id,
                            "label" : row.value.name,
                            "value" : row.value.name,
                            "rev" : row.value._rev
                        };
                    });
                    
                    $("#fee_combo_container").html( _.template( $("#fee_combo_template").html()  , {fees: fees } ));
                    
                    
                    $( "#fee_combo" ).combobox();
                    
                    
                     $( "#fees" ).autocomplete({
                        source: fees,
                        minLength: 0,
                        delay: 0,
                        select: function( event, ui ) {
                            console.log(ui);
                            if( section_backbone.fees.get( ui.item.id ) ){
                              $.jGrowl("You have already added this",{  theme: 'apple', position: "bottom-right"});
                              $.jGrowl("Please try again",{  theme: 'apple', position: "bottom-right"});
                                $( "#fees" ).val("").focus();
                                return false;
                            }else{
                                
                                obj = {
                                    section_id: resp.id,
                                    fee_id: ui.item.id,
                                    type: "sectionfee"
                                }
                                $.ajax({
                                type: "POST",
                                url: "/data",
                                data: $.toJSON(obj),
                                dataType: "json",
                                contentType: "application/json",
                                success: function( model ){
                                    
                                    console.log("Relationship added, add it to the backbone collection");
                                    
                                    section_backbone.fees.add( {
                                        "id": ui.item.id,
                                        "name": ui.item.label,
                                        "price": ui.item.price,
                                        "price": ui.item.price,
                                        "rev": model.rev
                                    } );
                                
                                }
                                });
                                
                            }
                            $( "#fees" ).val("").focus();
                            return false;
                            
                        },
                        close: function(){
                            
                        }
                    });
                   }
                });
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                            } else {
                                console.log("we have an error");
                            }
                        }
                    });

            });
                
               
            },
            testingAdd: function(event, ui ){
                             console.log(ui);
                             console.log(event);
                             console.log("ssss");
                            if( section_backbone.fees.get( ui.item.option.id ) ){
                              $.jGrowl("You have already added this",{  theme: 'apple', position: "bottom-right"});
                              $.jGrowl("Please try again",{  theme: 'apple', position: "bottom-right"});
                                $( "#fees" ).val("").focus();
                                return false;
                            }else{
                                
                                obj = {
                                    section_id: section_backbone.section_id,
                                    fee_id: ui.item.id,
                                    type: "sectionfee"
                                }
                                $.ajax({
                                type: "POST",
                                url: "/data",
                                data: $.toJSON(obj),
                                dataType: "json",
                                contentType: "application/json",
                                success: function( model ){
                                    
                                    console.log("Relationship added, add it to the backbone collection");
                                    console.log("as");
                                    console.log(ui.item);
                                    section_backbone.fees.add( {
                                        "id": ui.item.option.id,
                                        "name": ui.item.label,
                                        "rev": model.rev
                                    } );
                                
                                }
                                });
                                
                            }
                            $( "#fees" ).val("").focus();
                            return false;
                        },
            events: {
                "click #add-fee":  "feemodal",
                "keypress #fees":  "checkEnter"
            },
            addFee: function (model) {
                console.log(model);
                $("#sortablefees3").append("<li id='" + model.id + "'><div class='" + model.id + "' style='float: left; width: 170px; overflow: hidden;'>" + model.get("name") + "</div><span class='delete_fee delete'>Delete</span><span class='edit_fee edit'>Edit</span></li>");
                $(".edit", $("#sortablefees3")).button();
                $(".delete", $("#sortablefees3")).button();
                $( "#sortablefees3" ).sortable({
                    update: section_backbone.updateFeeValues
                });
                
                    section_backbone.updateFeeValues( model );
                
            },
            updateFeeValues: function(event, ui){
                       
                sections = $("#sortablefees3").sortable('toArray').toString();
                console.log(sections);
                $("#feelist").val( sections );
                
            },
            removeFee: function ( id ) {
                
               
                            section_backbone.updateFeeValues();
                                
                        
            
            },
            checkEnter: function(e){
                if (e.keyCode == 13 && $("#fees").val() == '') return false;
                if (e.keyCode != 13 || $("#fees").val() == '') return;
                //alert(currentVein);
        
                this.feemodal();
                
                return false;
            },
            feemodal: function(id) {
                if( typeof id != "string" ){
                    id = "";
                }
            $("#fee_form_modal").html("");
            var temp = $("#fee_form_modal");
            temp.hide();
            $("body").append(temp);
            
                if( id != "" ){
            var successfunc = function(data){
                    $("." + data.id).html(data.name);
                        
                             $("#fee_form_modal").dialog("close");
        }
    } else {
            var successfunc = function(data){
                     section_backbone.fees.add( {
                                        "id": data.id,
                                        "name": data.name,
                                        "price": data.price,
                                        "rev": data.rev
                                    } );
                    
                             $("#fee_form_modal").dialog("close");
                }
    }
            var modal_options = { 
                controller: "fee",
                documentid: id,
                modal: "yes",
                success: successfunc,
                targetPane: "#fee_form_modal"
            };
            new common_edit_view( modal_options );
            //_.jstTemplate( $("#fee_form_modal"), $("#common_edit_view_template"), );    
            console.log(temp)
            var mydialog = $(temp).dialog({
		        autoOpen: false,
                draggable: false,
                resizable: false,
                closeOnEscape: true,
                close: function(){
				 
			        mydialog.dialog("destroy");
			
                },
                beforeClose: function(){
				
				
		        },
                open: function(){
		
                },
                modal: true, 
                hide: 'drop',
                width: "960px",
                position: ["50%",100],
                height: "500"
            }).dialog("open");
                
                 
            }
        });
        
        var section_backbone = new SectionBackboneView;
        
        $(".delete_fee").die("click");
        $(".delete_fee").live("click", function() {
            if( confirm("Are you sure you want to delete this?") ){
                var id = $(this).parents("li").attr("id")
                $(this).parents("li").remove();
                 section_backbone.removeFee(id);
                 console.log(section_backbone.fees.get( id ));
                 section_backbone.fees.remove( section_backbone.fees.get( id ) );
                // $(this).parents("li").remove();
            }
            return false;
            
        });
        
        $(".edit_fee").die("click");
        
    
        
        
        (function( $ ) {
        $.widget( "ui.combobox", {
            _create: function() {
                var self = this,
                    select = this.element.hide(),
                    selected = select.children( ":selected" ),
                    value = selected.val() ? selected.text() : "";
                var input = this.input = $( "<input type='text' style='height: 14px; width: 100px;display: inline-block'>" )
                    .insertAfter( select )
                    .val( value )
                    .autocomplete({
                        delay: 0,
                        minLength: 0,
                        source: function( request, response ) {
                            var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
                            response( select.children( "option" ).map(function() {
                                var text = $( this ).text();
                                if ( this.value && ( !request.term || matcher.test(text) ) )
                                    return {
                                        label: text.replace(
                                            new RegExp(
                                                "(?![^&;]+;)(?!<[^<>]*)(" +
                                                $.ui.autocomplete.escapeRegex(request.term) +
                                                ")(?![^<>]*>)(?![^&;]+;)", "gi"
                                            ), "<strong>$1</strong>" ),
                                        value: text,
                                        option: this
                                    };
                            }) );
                        },
                        select: function( event, ui ) {
                            ui.item.option.selected = true;
                            
                            console.log(section_backbone);
                            section_backbone.testingAdd(event, ui);
                            $(event.currentTarget).val("");
                            return false;
                            self._trigger( "selected", event, {
                                item: ui.item.option
                            });
                        },
                        change: function( event, ui ) {
                            if ( !ui.item ) {
                                var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( $(this).val() ) + "$", "i" ),
                                    valid = false;
                                select.children( "option" ).each(function() {
                                    if ( $( this ).text().match( matcher ) ) {
                                        this.selected = valid = true;
                                        return false;
                                    }
                                });
                                if ( !valid ) {
                                    // remove invalid value, as it didn't match anything
                                    $( this ).val( "" );
                                    select.val( "" );
                                    input.data( "autocomplete" ).term = "";
                                    return false;
                                }
                            }
                        }
                    })
                    .addClass( "ui-widget ui-widget-content ui-corner-left" );

                input.data( "autocomplete" )._renderItem = function( ul, item ) {
                    return $( "<li></li>" )
                        .data( "item.autocomplete", item )
                        .append( "<a>" + item.label + "</a>" )
                        .appendTo( ul );
                };

                this.button = $( "<button type='button'>&nbsp;</button>" )
                    .attr( "tabIndex", -1 )
                    .attr( "title", "Show All Items" )
                    .insertAfter( input )
                    .button({
                        icons: {
                            primary: "ui-icon-triangle-1-s"
                        },
                        text: false
                    })
                    .removeClass( "ui-corner-all" )
                    .addClass( "ui-corner-right ui-button-icon" )
                    .click(function() {
                        // close if already visible
                        if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
                            input.autocomplete( "close" );
                            return;
                        }

                        // pass empty string as value to search for, displaying all results
                        input.autocomplete( "search", "" );
                        input.focus();
                    });
            },

            destroy: function() {
                this.input.remove();
                this.button.remove();
                this.element.show();
                $.Widget.prototype.destroy.call( this );
            }
        });
    })( jQuery );

        
        
        
        
        $("#add-fee").button();
        
        
        
        $(".edit_fee").live("click", function() {
            var id = $(this).parents("li").attr("id");
            section_backbone.feemodal(id);
            //section_backbone.removeFee(id);
            //$(this).parents("li").remove();
            return false;
        });
    }

});

