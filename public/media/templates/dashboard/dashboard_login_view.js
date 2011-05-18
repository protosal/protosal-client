dashboard_login_view = Backbone.View.extend({
    initialize: function( options ) {
        this.renderView("#contentpane", "#dashboard_login_view_template", options );
        
            LoginView = Backbone.View.extend({
        el: $("#loginwindow"),
        initialize: function(){
            $(".tabs").tabs();
            $("a[rel='example1']").colorbox();
    $(".userui").fadeOut(300);
        },
        events: {
            "click #loginbutton": "requestLogin",
            "click #registerbutton": "requestRegister"
        },
        requestLogin: function() {
            formdata = $("#loginform").serializeObject();
            
            $.ajax({
                url: GLOBALS.server_base + "user/login",
                dataType: "json",
                type: "POST",
                data: $.toJSON(formdata),
                contentType: "application/json",
                success: function(data){
                    GLOBALS.session = true;
                    
                    GLOBALS.username = $("#username").val(); // never use for transactions

  var clicky_custom = {};
  clicky_custom.session = {
    username: GLOBALS.username,
    email: GLOBALS.username
  };
  
                    clicky.log("User logged in:" + GLOBALS.username);

                    $(".userui").fadeIn(300);
                    redirect( "dashboard/home" );
                }
            });
            
            return false;
        },
        requestRegister: function() {
         formdata = $("#registrationform").serializeObject();
            $.ajax({
                url: GLOBALS.server_base + "user/register",
                dataType: "json",
                type: "POST",
                data: $.toJSON(formdata),
                contentType: "application/json",
                success: function(data, headers){
                    $("#username").val($("#email").val());
                    setTimeout( function(){$("#password").focus();}, 300);
                    $(".userpage").click();
                       $.jGrowl("Thanks for signing up, check your inbox for activation",{  theme: 'green', position: "top-right"});
                    clicky.log("User registered: " +$("#email").val());
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
     $("#demoaccount").click( function(){
        $("#username").val("testing@protosal.com");
        $("#password").val("flying");
        return false;
    });
    $(".userpage").click( function(){
        tab = $(this).attr("href");
        if( $(this).hasClass("register") ){
           clicky.log("Register button clicked");
           $("#tab-1").removeClass("active-tab"); 
           $("#tab-2").addClass("active-tab"); 
           $(this).removeClass("register").addClass("login").addClass("orange").removeClass("blue");
           $(this).text("Back to Login");
           setTimeout( function (){     $("#email").focus(); }, 100);
        } else {
           clicky.log("Back to login clicked");
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
