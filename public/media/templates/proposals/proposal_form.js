proposal_form_view = Backbone.View.extend({

    initialize: function( options ) {
        this.renderView("#proposal_formc", "#proposal_form_template", options );
    
    FeeModel = Backbone.Model.extend({
        initialize: function() {
            console.log("New Fee Model created");
        }
    });

    ClientModel = Backbone.Model.extend({
        initialize: function() {
            console.log("New Client Model created");
        }
    });


    FeeCollection = Backbone.Collection.extend({
        model: FeeModel,
        initialize: function(){
            console.log("Initialize the Fee collection");
        }
    });
    ClientComboView = Backbone.View.extend({
        el: $("#clients_combo_container"),
        initialize: function(){
            
            
        },
        renderCombo: function(){
            var client_combo = this.view.el;
            this.client_id = proposal_view.client_id;
            client_combo.html( _.template( $("#clients_combo_form_element").html(), this ) );
        }
    });
    ClientCollection = Backbone.Collection.extend({
        model: FeeModel,
        initialize: function(){
            console.log("Initialize the Client collection");
            this.view = new ClientComboView;
            this.bind("refresh", this.view.renderCombo)
        },
        getAllClients: function(){
            console.log("Start fetching the clients");
            clients = {};
            $.when( $.ajax("list_by_author_templates/client", { dataType: "json" }) )
                .then( function(data) {
                    //Update this clients
                    console.log("Clients received, send them to collection");
                    proposal_view.clients.refresh(data);
            }); //When statement end
        }
    });
    SectionModel = Backbone.Model.extend({
        initialize: function() {
            console.log("New Section Model created");
        }
    });
    SectionCollection = Backbone.Collection.extend({
        model: SectionModel,
        initialize: function(){
            console.log("Initialise the Section collection");
            //this.bind("refresh", function() { proposal_view.addSectionRender(); });
            //this.bind("add", this.addEvent );
			this.bind("remove", this.deleteRelation );
        },
        deleteRelation: function( model ){
			// This is deprecated
		},
        addToPreview: function(section) {
            console.log("adding to preview");

            console.log(section);
            proposal_view.toc.addSection(section);
            proposal_view.section_container.addSection(section);
        },
        getAllTemplates: function(){
            console.log("Start fetching the section templates");
            section_templates = {};
            $.when( $.ajax("list_by_author_templates/section", { dataType: "json" }) )
                .then( function(data) {
                    //Update this collections sections
                    console.log("Template sections received, send them to collection");
                    proposal_view.allsections.refresh(data);
            }); //When statement end
        },
        getRelated: function(){
            console.log("Get related sections")
            var that = this;
            console.log("get related that");
            console.log(that);
            $.ajax({
                url: "related2/proposal_section/" + that.proposalid,
                success: function(resp){
                    console.log("Found related sections");
                    console.log(resp);
                    
                    var sectionlist = options.sectionlist;
                    var sorted = _.sortBy( resp, function( row ) { return sectionlist.indexOf(row.value._id); } );
                    _.each( sorted, function(model) {
                        model.value.id = model.value._id;
                        that.sections.add(model.value)
                    })
                }
            })
            
        }
    });
    FeeTableView = Backbone.View.extend({
        initialize: function( section ){
            console.log("build the table");
            console.log(section);
            var feelist = section.get("feelist");
            console.log("Feetable feelist");
            console.log(feelist);
            var obj = {
                   keys: feelist
            };
            if( obj.keys != "" ){
                $.when( $.ajax("data/bulk_docs", { type: "post", dataType: "json", contentType: "application/json", data: $.toJSON(obj) }) )
                .then( function(data) {
                    //Update this collections sections
                    console.log("received fee data");
                    $(".section_table", $(".section_" + section.cid) ).html( _.template( $("#section_fee_table_template").html(), { fees: data} ) );
                    proposal_view.applyVariables( $(".section_" + section.cid) );
                }); //When statement end
            } else {
                $(".section_table", $(".section_" + section.cid) ).html("");
                
            }
            
        }
    })
    SectionsContainer = Backbone.View.extend({
        el: $("#section_container_test"),
        initialize: function(){
            console.log("Iniitalize sections container");
            console.log(this.el)
            $(".cid").die( "click" );
            $(".cid").live( "click", this.openEdit );
            $(".delete_section").live( "click", this.deleteSection );
        },
        deleteSection: function( event ) {
			cid = $(event.currentTarget).parents("li").attr("cid");
			model = proposal_view.sections.getByCid(cid);
			id = model.get("id");
			proposal_view.sections.remove(model);
			$("#" + id ).remove();
			$("li[cid='" + cid + "']").remove();
            proposal_view.toc.updateOrder();
			return false;
		},
        addSection: function( section ){
            console.log("Add to sections container")
            console.log($("#proposal_preview_section").html())
            if( typeof section.attributes.description != "undefined" ) {
                 $("#section_container_test ol").append( _.template( $("#proposal_preview_section").html(), { section: section } ) );
                 var feetable = new FeeTableView( section );
                $(".section_content", ".section_" + section.cid).html( _.template( $("#proposal_preview_section_content").html(), section.attributes ) );
                proposal_view.applyVariables( ".section_" + section.cid );
            } else {
                $("#section_container_test ol").append( _.template( $("#proposal_preview_section").html(), { section: section } ) );
                $.ajax({
                    url: "data/newinstance/" + proposal_view.proposalid + "/" + section.get("template_id"),
                    success: function( response ){
                        $(".section_content", ".section_" + section.cid).html( _.template( $("#proposal_preview_section_content").html(), response ) );
                        section.set({ id: response._id});
                        section.set(response);
                        var feetable = new FeeTableView( section );
                        $("li[id='" + section.cid + "']").attr("id", response._id);
                        proposal_view.toc.updateOrder();
                        proposal_view.applyVariables( ".section_" + section.cid );
                    }
                });
            }
        },
        openEdit: function( event ) {   
            sectionEl = $(event.currentTarget);
            cid = sectionEl.attr("cid");
            template_id = sectionEl.attr("template_id");
            section = (proposal_view.sections.getByCid(cid));
            console.log("opening edit screen")
            console.log(section)
            $("#atestform").html(" ");
            var temp = $("#atestform");
            temp.hide();
            $("body").append(temp);
             
            var modal_options = { 
                controller: "section",
                documentid: section.get("_id"),
                templateid: template_id,
                modal: "yes",
                success: function(data){
         
                     $("#atestform").dialog("close");
                         $.ajax({
                            url: "data/" + section.id,
                            success: function( response ){section_fee_table_template
                                $(".section_content", ".section_" + cid).html( _.template( $("#proposal_preview_section_content").html(), response ) );
                                $(".section_heading", ".section_" + cid).text(response.name);
                                $("#"+section.id).text(response.name); // set the toc name
                                section.set(response);
                                var feetable = new FeeTableView( section );
                                proposal_view.applyVariables( ".section_" + cid );
                            }
                        });
                },
                targetPane: "#atestform"
                
            };
            
            new common_edit_view( modal_options );   
            var mydialog = $(temp).dialog({
		        autoOpen: false,
                draggable: false,
                resizable: false,
                closeOnEscape: true,
                close: function(){
                    
                    delete CKEDITOR.instances.description
			        mydialog.dialog("destroy");
                        $.ajax({
                            url: "data/" + section.id,
                            success: function( response ){section_fee_table_template
                                $(".section_content", ".section_" + cid).html( _.template( $("#proposal_preview_section_content").html(), response ) );
                                $(".section_heading", ".section_" + cid).text(response.name);
                                $("#"+section.id).text(response.name); // set the toc name
                                section.set(response);
                                var feetable = new FeeTableView( section );
                                proposal_view.applyVariables( ".section_" + cid );
                            }
                        });
                },
                beforeClose: function(){
				    
                    console.log(cked);
				    
		        },
                open: function(){
			        $("form input").focus();      
                },
                modal: true, 
                hide: 'drop',
                width: "960px",
                position: ["50%",100],
                height: "500"
            }).dialog("open");
        }
    });
    SectionChooser = Backbone.View.extend({
        el: $("body"),
        activemodal: null,
        selectedSections: null,
        initialize: function(){
    
        },
        events: {
            "click .section_list_item":    "toggleTick",  
            "click .new_section_button":    "openNew",  
            "click .add_sections":         "addToPreview"
        },
        toggleTick: function(event){
            
            list_item = $(event.currentTarget);
            tick = $(".tick", list_item);
            if( tick.hasClass("ticked") ){
                tick.removeClass("ticked")
            } else{
                tick.addClass("ticked")
            }
            
        },
        addToPreview: function(){
            $(".section_temp li").each( function(){
                if( $(".tick", this).hasClass("ticked") ){
                    proposal_view.sections.add( { template_id: $(this).attr("section_id") , name: $(this).text() }  );
                }    
            })
            this.activemodal.dialog("destroy");
            $(".section_temp").remove();
        },
        renderList: function( sections ){
        
            proposal_view.section_chooser.activemodal = $("<div class='section_temp'>").html( _.template( $("#section_chooser_list_template").html(), {sections: sections} ) )
            
            proposal_view.section_chooser.activemodal.dialog({
                autoOpen: false,
                draggable: false,
                resizable: false,
                closeOnEscape: false,
                title: "New Fee",
                modal: true, 
                hide: 'drop',
                width: "550px",
            }); 
                
            proposal_view.section_chooser.activemodal.dialog("open");
            console.log("Dialog created")
            
        },
        openNew: function( event ) {   
            var that = this;
            $("#atestform").html(" ");
            var temp = $("#atestform");
            temp.hide();
            $("body").append(temp);
             var modal_options = { 
                controller: "section",
                modal: "yes",
                success: function(data){
                    proposal_view.allsections.add({ value: { _id: data.id, name: $(".section_name").val()} });
                    console.log(proposal_view.allsections);
                    proposal_view.section_chooser.activemodal.html(_.template( $("#section_chooser_list_template").html(), {sections: proposal_view.allsections.models} ));
                    delete CKEDITOR.instances.description
                    $("#atestform").dialog("close");
                },
                targetPane: "#atestform"
            };
            new common_edit_view( modal_options );
            
            var mydialog = $(temp).dialog({
		        autoOpen: false,
                draggable: false,
                resizable: false,
                closeOnEscape: true,
                close: function(){
                    
                    delete CKEDITOR.instances.description
			        mydialog.dialog("destroy");
            
                },
                beforeClose: function(){
				    
                    console.log(cked);
				    
		        },
                open: function(){
			        $("form input").focus();      
                },
                modal: true, 
                hide: 'drop',
                width: "960px",
                position: ["50%",100],
                height: "500"
            }).dialog("open");
            return false;
        }
    
    })
    TOCView = Backbone.View.extend({
        el: $("#proposal_preview_toc"),
        initialize: function(){
            console.log("Initialize the table of contents");
        },
        addSection: function( section ){
            console.log("Add section to the ordered list");
            console.log(this);
            $("#toc_list").append( _.template( $("#toc_list_item").html(), { section: section } ) );
            $("#toc_list").sortable({
                update: function(event, ui) {
                    console.log(arguments);
                proposal_view.toc.updateOrder(event, ui)
                }
            }); 
            // If this item is being added at page load don't do that shit above
            proposal_view.toc.updateOrder();
            proposal_view.applyVariables( "#toc_list" );
        },
        updateOrder: function(event,ui){
            if( typeof ui != "undefined") {
                
                listitem = $(ui.item[0]);
                console.log("hey")
                console.log(listitem)
                console.log($("#toc_list"));
                position = ($("#toc_list li").index(listitem)) + 1;
                cid = proposal_view.sections.get($(listitem).attr("id")).cid;
                sec = $(".proposal_preview #section_container_test li.cid:nth-child("+position+")");
                if( $(".proposal_preview #section_container_test li.cid:last").text() == sec.text() ){
                    sec.after($(".section_"+cid))
                } else {
                    sec.before($(".section_"+cid))
                }
                
            }
            sections = $("#toc_list").sortable('toArray').toString();
            console.log("Update order of sections");
            console.log(sections);
            $("#sectionlist").val( sections );
        }
    });
    ClientsView = Backbone.View.extend({
        el: $("#clients_combo"),
        initialize: function(){
            console.log("Initializing the clients view");
                        $.when( $.ajax("list_by_author_templates/section", { dataType: "json" }) )
                .then( function(data) {
                    //Update this collections sections
                    console.log("Template sections received, send them to collection");
                    proposal_view.allsections.refresh(data);
            }); //When statement end
        }
    
    });
    SideMenu = Backbone.View.extend({
        el: $("#sidemenu"),
        events: {
            "click #side_add_section": "openModal",
            "click #side_print_preview": "printPreview",
            "click #side_view_pdf": "openPdf",
            "click #side_email_pdf": "emailPdf"
            
        },
        openModal: function(){
            proposal_view.addSectionRender();
            
        },
        printPreview: function(event){
            button = $(event.currentTarget);
            if( $(button).attr("editing") == "true" ){
                $("span", button).text("Back to editing");
                $(button).addClass("ui-state-active");
                $("#proposal_editing").attr("href", "");
                $(button).attr("editing","false");
            } else {
                $("span", button).text("Print Preview");
                $(button).removeClass("ui-state-active");
                $("#proposal_editing").attr("href", "/media/css/proposal_editing.css");
                $(button).attr("editing", "true");
            }
            
        },
        openPdf: function(){
            html = $(".proposal_preview_container").html();
            css = $("#proposal_css").val();
            $("#pdfcrowd").text(css  + html);
            $("#open_pdf_proposal").val( $("#proposal_name").val() );
            $("#pdfcrowdform").submit();   
        },
        emailPdf: function(){
            proposal_view.emailmodal = new EmailPdfView;
            $("#email_pdf_modal").dialog({
                draggable: false,
                resizable: false,
                closeOnEscape: true,
                modal: true, 
                hide: 'drop',
                width: "500px",
                position: ["50%",100],
                height: "500"
            });
            html = $(".proposal_preview_container").html();
            css = $("#proposal_css").val();
            $("#email_pdf_html").text(css  + html);
            
        }
    });
    EmailPdfView =  Backbone.View.extend({
        el: $("#email_pdf_modal"),
        initialize: function(){
        },
        events: {
            "click .send_email_button": "sendEmail"
        },
        sendEmail: function(event){
            $("#email_pdf_message").val( proposal_view.replaceVariables( $("#email_pdf_message").val() ) );
            $("#email_pdf_subject").val( proposal_view.replaceVariables( $("#email_pdf_subject").val() ) );
            $("#email_pdf_proposal").val( $("#proposal_name").val() );
            
            var formdata = $("#email_pdf_form").serializeObject();
            
            $(event.currentTarget).parents(".ui-dialog-content").dialog("close");
            
            $.ajax({
                url: "pdf/email",
                data: formdata,
                dataType: "json",
                type: "POST",
                success: function( data ){
                     $.jGrowl("Email sent successfully",{  theme: 'success', position: "top-right"});   
                }
            })
            return false;
        }
    });
    UserDetails = Backbone.Model.extend({
        initialize: function(){
            var that = this;
            $.ajax({
                url: "user",
                dataType: "json",
                success: function( data ) {
                    that.set( data );
                    console.log("user model");
                    console.log(that);
                    $(".proposal_details").html( _.template($("#proposal_details_template").html(), { details: that }) );
                }
            })   
        }
    });
    ProposalView = Backbone.View.extend({
    
        el: $("#proposal_form_container"),
        sections: null,
        fees: null,
        toc: null,
        allsections: null,
        clients: null,
        client_id: options.client_id,
        client: null,
        initialize: function(){
            var that = this;
            console.log("Initialize the proposal view");
            $("body").append("<div class='proposal_preview_container'><div style='' class='proposalcontainer proposal_preview container'>Yo</div></div>");

            $.when( this.get_id() ).then( $.proxy( function(data){
                $(".proposalcontainer").html( _.template( $("#proposal_preview").html(), { name: $("#proposal_name").val() } ) );
                console.log(arguments);
                console.log("Get the proposal id");
                that.proposalid = data.id;
                
                if( options.client_id != "" ){
                    $.ajax( "data/" + options.client_id ,{
                        dataType: "json",
                        success: function(data){
                            that.client = data;
                            console.log(data)
                            if( typeof data.email != "undefined" ){
                                $("#email_pdf_client").val(data.email);
                            }
                            that.applyVariables( ".proposal_view" );
                        }
                    })
                }
                this.userdetails = new UserDetails;
                this.sections = new SectionCollection;
                
                this.sections.bind("add", this.sections.addToPreview);
                this.sections.getRelated.apply(this);
                
                this.allsections = new SectionCollection;
                this.allsections.getAllTemplates();

                this.clients = new ClientCollection;
                this.clients.getAllClients();
                console.log(this.clients);
                this.fees = new FeeCollection;
                
                this.toc = new TOCView;
                this.section_container = new SectionsContainer;
                this.sidemenu = new SideMenu;
                this.section_chooser = new SectionChooser;
                
                
            }, this)

            )
        },
        events: {
            "keyup #proposal_name": "updatePreview", //Wrong should update model and model should listen for changes
            "change #client_combo": "updateClientData"
        },
        getClientData: function(){
            
        },
        updatePreview: function( event ){
            $("#preview_proposal_name").text($(event.currentTarget).val())  
        },  
        updateClientData: function( event ){
            id = $(event.currentTarget ).val();
            if( id != ""){
                $.when( $.ajax("data/" + id ) )
                .then( function(data) {
                    proposal_view.client = data
                    $("#email_pdf_client").val(data.email);
                    proposal_view.applyVariables( ".proposal_preview" );
                }); //When statement end
            } else {
                    $("#email_pdf_client").val("No client set");
                    proposal_view.client = null;
                    proposal_view.applyVariables( ".proposal_preview" );
            }
        },
        getVariables : function(){
            var  variables = {};
            proposal_details = {
                proposal_name: $("#preview_proposal_name").text(),
                company_name: proposal_view.userdetails.get("companyname"),
                company_shortdescription: proposal_view.userdetails.get("companyshortdescription"),
                company_phone: proposal_view.userdetails.get("phone"),
                company_fax: proposal_view.userdetails.get("fax")
            };
            variables = _.extend(variables, proposal_details);
            client_variables = {};
            _.each( proposal_view.client, function( value, key ) {
                client_variables["client_" + key] = value;
            });
            variables = _.extend(variables, client_variables);
            return variables;
        },
        replaceVariables: function( inputvalue ){
              var variables = proposal_view.getVariables();
              
                    var matches = inputvalue.match(/\{\{([^}]+)\}\}/g);
                    for (i in matches) {
                        variable = matches[i].substr(2, matches[i].length-4);
                        if( typeof variables[variable] != "undefined"){
                            inputvalue = inputvalue.replace(matches[i],variables[variable])
                        }
                    }
            return inputvalue;
        },
        applyVariables: function( element ) {
                var variables = proposal_view.getVariables();
                    $(".variable", $(element) ).each(function(index){
                        console.log(this)
                        $(this).after("{{" + $(this).attr("name") + "}}");
                        $(this).remove();
                    })
                    $(".empty_variable", $(element) ).each(function(index){
                        console.log(this)
                        $(this).after("{{" + $(this).attr("name") + "}}");
                        $(this).remove();
                    })
                    var previewhtml = $(element).html();
                    var matches = previewhtml.match(/\{\{([^}]+)\}\}/g);
                    for (i in matches) {
                        variable = matches[i].substr(2, matches[i].length-4);
                        if( typeof variables[variable] != "undefined"){
                            if( variables[variable] != "") {
                                 previewhtml = previewhtml.replace(matches[i],"<span class='variable' name='"+variable+"'>"+variables[variable]+"</span>");
                            } else {
                               previewhtml = previewhtml.replace(matches[i],"<span class='empty_variable' name='"+variable+"'>{&#123;"+variable+"}}</span>"); 
                            }
                        }  else {
                            previewhtml = previewhtml.replace(matches[i],"<span class='empty_variable' name='"+variable+"'>{&#123;"+variable+"}}</span>");
                        }
                    }
                    $(element).html(previewhtml);
                        $("#toc_list").sortable({
                            update: function(event, ui) {
                                console.log(arguments);
                            proposal_view.toc.updateOrder(event, ui)
                            }
                        }); 
        },
        addSectionRender: function(){
            console.log( "Render the add section modal window" );
            var sections = this.allsections.models;
            // Now that we have all the section templates, populate the section choose
            proposal_view.section_chooser.renderList(sections);

        },
        get_id: function(){
            if( GLOBALS.route_id == "" ){
                // Get the empty form fields and serialize them sresponseo we can insert into the database
                formdata = $(".edit_proposal_form").serializeObject();
                // Add the type of form to the form object
                formdata.type = "proposal";
                formdata.status = "pending";
                formdata.template = true;
                return $.ajax( "data", {
                        dataType: "json",
                        type: "POST",
                        contentType: "application/json",
                        data: $.toJSON(formdata),
                        success: function(resp){
                            //Unbind the default click handler and attach a new one now that we have created a new proposal
                            $('.proposal_save').unbind('click');
                            $(".proposal_save").click({
                                templateid: "",
                                _rev: resp.rev,
                                _id: resp.id,
                                success: options.success
                            }, window.saveclickHandler );
                        }
                    });
            }  else {
                return { id: GLOBALS.route_id };
            }
        }
    });
    proposal_view = new ProposalView;
  
    $( "#radio" ).buttonset();
    $("#email_pdf_form .button").button();
    thechecked = options.status;
    $("input[value='"+thechecked+"']").attr("checked", "checked")
    
    $( "#radio" ).buttonset('refresh');
    
    }
});