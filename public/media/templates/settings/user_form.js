user_form_view = Backbone.View.extend({
    initialize: function( options ) {
        this.renderView("#user_formc", "#user_form_template", options);
        clicky.log("i am settings page");
        $('.user_save').unbind('click');

        $('.user_save').click(function() {
            $("#add_settings_form").submit();
            return false;
        });
    }
});
