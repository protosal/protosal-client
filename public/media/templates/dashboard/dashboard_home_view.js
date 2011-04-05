
dashboard_home_view = Backbone.View.extend({
	
	
	initialize: function( options ){ 
	 
		this.renderView( "#contentpane", "#dashboard_home_view_template", options );
		
    var chart;
    function generate_chart(series) {
        console.log("Generate Chart Series:");
        console.log(series);

        return new Highcharts.Chart({
            chart: {
                renderTo: 'graph',
                defaultSeriesType: 'column',
                marginRight: 130,
                marginBottom: 25
            },
            colors: [
                "#66cc00",
                "#ff3333",
                "#ffcc33"     
            ],
            title: {
                text: '',
                x: -20 //center
            },
            xAxis: {
                categories: ['Proposals', '']
            },
            yAxis: {
                title: {
                    text: 'Total'
                },
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: '#808080'
                }]
            },
            tooltip: {
                formatter: function() {
                        return '<b>'+ this.series.name +'</b><br/>'+
                        this.x +': '+ this.y +' Total';
                }
            },
            legend: {
                layout: 'vertical',
                align: 'right',
                verticalAlign: 'top',
                x: -10,
                y: 100,
                borderWidth: 0
            },
            series: series
        });
    }

    function process_data(data) {
        var series = {
            'Accepted': [0],
            'Declined': [0],
            'Pending': [0]
        };

        for(var i = 0; i < data.length; i++) {
            var series_name = _.capitalize( data[i].key[1] );
            series[ series_name ][0] = data[i].value;
        }

        var seriesArray = [];

        for( var key in series ) {
            if( series.hasOwnProperty( key ) ) {
                seriesArray.push( { name: key, data: series[ key ] } );
            }
        }
        
        return seriesArray;
    }

    $(document).ready(function() {
        setTimeout( function(){    
            $.ajax({
                url: '/proposal/stats',
                dataType: 'json',
                success: function(data) {
                    var series = process_data( data );
                    chart = generate_chart( series );
                }
            });
        });
    }, 2000);

    $(function() {
    $( ".column" ).sortable({
        connectWith: ".column",
        disabled: true
    });

    $( ".portlet" ).addClass( "ui-widget ui-widget-content ui-helper-clearfix ui-corner-all" )
        .find( ".portlet-header" )
            .addClass( "ui-widget-header ui-corner-all" )
            .prepend( '<span class="ui-icon ui-icon-minusthick"></span>')
            .end()
        .find( ".portlet-content" );

    $( ".portlet-header .ui-icon" ).click(function() {
        $( this ).toggleClass( "ui-icon-minusthick" ).toggleClass( "ui-icon-plusthick" );
        $( this ).parents( ".portlet:first" ).find( ".portlet-content" ).toggle();
    });

    $( ".column" ).disableSelection();

    $(".corners").corner("3px");


    options = {
        'title': 'Dashboard',
        'buttons': [{
                        'text': 'New Proposal',
                        'href': '#/proposal/edit',
                        'classes': 'addbutton'
            },{
                        'text': 'New Client',
                        'href': '#/client/edit',
                        'classes': 'addbutton'
            },
        ]
        
    }
    $.ajax({
        dataType: "json",
        url: "proposal/all/pending",
        success: function(data){
            if( data.length > 0 ){
                $(".pending_container").html( _.template( $("#recent_container_template").html(), { proposals: data} ) );
                
                 $(".corners").corner("3px");
            } else {
                $(".pending_container").html( "You have no pending proposals. ")
            }
        }
    })
    $.ajax({
        dataType: "json",
        url: "proposal",
        success: function(data){
                        if( data.length > 0 ){
                $(".recent_container").html( _.template( $("#recent_container_template").html(), { proposals: data} ) );
              
                 $(".corners").corner("3px");
            } else {
                $(".recent_container").html( "You have no recent proposals. ");
                
            }
        }
    })
    $("#pageheader").html( _.template( $("#page_header_template").jsthtml(), options ) );
});
	}
});
