// ## Client Edit Form View
// Client form is a pretty standard form
client_form_view = Backbone.View.extend({
    initialize: function( options ){
        this.renderView("#client_formc", "#client_form_template", options);
        
        // Lets just run jquery UI tabs to tabulate the fields.
        $("#client_tabs").tabs();
    
    }
});
