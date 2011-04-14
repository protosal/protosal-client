
Backbone.View = Backbone.View.extend({
    renderView: function( target, template, options ){
        $(target).html( _.template( $(template).html(), options));
    }
});
