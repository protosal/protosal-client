dashboard_login_view = Backbone.View.extend({
    initialize: function( options ) {
        this.renderView("#contentpane", "#dashboard_login_view_template", options );
        
            LoginView = Backbone.View.extend({
        el: $("#loginwindow"),
        initialize: function(){
            console.log("hey anold");
            $(".tabs").tabs();
        },
        events: {
            "click #loginbutton": "requestLogin",
            "click #registerbutton": "requestRegister"
        },
        requestLogin: function() {
            console.log("hi");
            formdata = $("#loginform").serializeObject();
            console.log(formdata);
            
            $.ajax({
                url: "user/login",
                dataType: "json",
                type: "POST",
                data: $.toJSON(formdata),
                contentType: "application/json",
                success: function(data){
                    GLOBALS.session = true;
                    
                    GLOBALS.username = $("#username").val(); // never use for transactions
                    redirect( "dashboard/home" );
                    console.log("whoop round 2");
                    console.log(data);
                }
            });
            
            return false;
        },
        requestRegister: function() {
         formdata = $("#registrationform").serializeObject();
            console.log(formdata);
            $.ajax({
                url: "user/register",
                dataType: "json",
                type: "POST",
                data: $.toJSON(formdata),
                contentType: "application/json",
                success: function(data, headers){
                    $("#username").val($("#email").val());
                    setTimeout( function(){$("#password").focus();}, 300);
                    $(".userpage").click();
                       $.jGrowl("Thanks for signing up, now log in fool",{  theme: 'green', position: "top-right"});
                }
            });
            return false;
        }
    });
    
    var loginview = new LoginView;
    
    setTimeout( function (){ 
        if( options.route_id ) {   
            $("#password").focus();
            $.jGrowl("Your account has been activated",{  theme: 'green', position: "top-right"});
        } else {
            $("#username").focus();
        }
         }, 100);
    $("button").button();
    $(".userpage").click( function(){
        tab = $(this).attr("href");
        if( $(this).hasClass("register") ){
           $("#tab-1").removeClass("active-tab"); 
           $("#tab-2").addClass("active-tab"); 
           $(this).removeClass("register").addClass("login").addClass("orange").removeClass("blue");
           $(this).text("Back to Login");
           setTimeout( function (){     $("#email").focus(); }, 100);
        } else {
           $("#tab-2").removeClass("active-tab"); 
           $("#tab-1").addClass("active-tab"); 
           
            $(this).text("Start Free Trial");
           $(this).removeClass("login").addClass("register").addClass("blue").removeClass("orange");
           setTimeout( function (){     $("#username").focus(); }, 100);
        }
        return false;
    });
    $("#tab-1").addClass("active-tab");
    }

});
