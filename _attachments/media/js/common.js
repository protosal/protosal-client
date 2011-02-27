// Shortcut to redirect content pane.
function redirect( url ) {
    window.location = "#/" + url;
}

// Shortcut to refresh content pane.
function refresh () {
    $(window).trigger( 'hashchange' );
}
(function($,undefined){
  '$:nomunge'; // Used by YUI compressor.
  
  $.fn.serializeObject = function(){
    var obj = {};
    
    $.each( this.serializeArray(), function(i,o){
      var n = o.name,
        v = o.value;
        
        obj[n] = obj[n] === undefined ? v
          : $.isArray( obj[n] ) ? obj[n].concat( v )
          : [ obj[n], v ];
    });
    
    return obj;
  };
  
})(jQuery);
_.mixin({
    capitalize : function(string) {
        return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
    },
    escapeHTML: function(string) {
        return typeof string == "string" ? string
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;") : "";
    },
    isInt: function(x) {
        var y=parseInt(x);
        if (isNaN(y)) return false;
        return x==y && x.toString()==y.toString();
    }
});

/*
 * Two jquery plugins below to handle errors and highlights in jQuery UI, no native support WTF?
 */
(function($){
     $.fn.uierror = function(){
    	 
        return this.each(function(){
           var $this = $(this);
           message = $(this).html();
           var errorHtml = "<div class=\"ui-widget\">";
           errorHtml+= "<div class=\"ui-state-error ui-corner-all\" style=\"padding: 0.7em;\">";
           errorHtml+= "<p>";
           errorHtml+= "<span class=\"ui-icon ui-icon-alert\" style=\"float:right; margin-right: .3em;\"></span>";
           errorHtml+= message;
           errorHtml+= "</p>";
           errorHtml+= "</div>";
           errorHtml+= "</div>";

           $this.html(errorHtml);
        });
     }
})(jQuery);

(function($){
     $.fn.uihighlight = function(){
        return this.each(function(){
           var $this = $(this);
           message = $(this).html();
           var alertHtml = "<div class=\"ui-widget\">";
           alertHtml+= "<div class=\"ui-state-highlight ui-corner-all\" style=\"padding: 0.7em;\">";
           alertHtml+= "<p>";
           alertHtml+= "<span class=\"ui-icon ui-icon-info\" style=\"float:right; margin-right: .3em;\"></span>";
           alertHtml+= message;
           alertHtml+= "</p>";
           alertHtml+= "</div>";
           alertHtml+= "</div>";

           $this.html(alertHtml); 
        });
     } 
})(jQuery);
function objectToString(o){
    
    var parse = function(_o){
    
        var a = [], t;
        
        for(var p in _o){
        
            if(_o.hasOwnProperty(p)){
            
                t = _o[p];
                
                if(t && typeof t == "object"){
                
                    a[a.length]= p + ":{ " + arguments.callee(t).join(", ") + "}";
                    
                }
                else {
                    
                    if(typeof t == "string"){
                    
                        a[a.length] = [ p+ ": \"" + t.toString() + "\"" ];
                    }
                    else{
                        a[a.length] = [ p+ ": " + t.toString()];
                    }
                    
                }
            }
        }
        
        return a;
        
    }
    
    return "{" + parse(o).join(", ") + "}";
    
};
