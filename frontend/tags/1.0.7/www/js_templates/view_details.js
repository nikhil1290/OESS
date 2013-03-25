[% INCLUDE js_templates/graph.js %]

<script>

function init(){

    var tabs = new YAHOO.widget.TabView("tabs");

    var ds = make_circuit_details_datasource();

    ds.sendRequest("", {success: function(req, resp){

		             var details = resp.results[0];

			     save_session_from_datasource(details);

		             page_init();
	                },
		        failure: function(req, resp){
		             alert("Error loading circuit details.");
	                }
		   });

}

function make_circuit_details_datasource(){
    var ds = new YAHOO.util.DataSource("services/data.cgi?action=get_circuit_details&circuit_id="+session.data.circuit_id);
    ds.responseType = YAHOO.util.DataSource.TYPE_JSON;
    ds.responseSchema = {
	resultsList: "results",
	fields: [
           {key: "circuit_id", parser: "number"},
           {key: "description"},
           {key: "bandwidth", parser: "number"},
           {key: "links"},
           {key: "backup_links"},
           {key: "endpoints"},
           {key: "state"},
           {key: "active_path"}
	]
    };

    return ds;
}

function save_session_from_datasource(details){
    session.clear();

    session.data.circuit_id   = details.circuit_id;
    session.data.description  = details.description;
    session.data.bandwidth    = details.bandwidth * 1000000;
    session.data.state        = details.state;
    session.data.active_path  = details.active_path;
    session.data.interdomain  = 0;
    session.data.endpoints    = [];
    session.data.links        = [];
    session.data.backup_links = [];
    session.data.passthrough  = [];

    for (var i = 0; i < details.endpoints.length; i++){
	var endpoint = details.endpoints[i];
        
	var endpoint_data = {node: endpoint.node,
			     interface: endpoint.interface,
                 interface_description: endpoint.interface_description,
			     tag: endpoint.tag,
			     role: endpoint.role,
			     urn: endpoint.urn,
			     local: endpoint.local
	                     };

	if (endpoint.local == 0){
	    session.data.interdomain = 1;
	}

	if (endpoint.role == "trunk"){
	    session.data.passthrough.push(endpoint_data);
	}
	else{
	    session.data.endpoints.push(endpoint_data);
	}

    }

    for (var i = 0; i < details.links.length; i++){
	var path_component = details.links[i];
	session.data.links.push(path_component.name);
    }

    for (var i = 0; i < details.backup_links.length; i++){
	var path_component = details.backup_links[i];
	session.data.backup_links.push(path_component.name);
    }

    session.save();
}

function page_init(){
  // defined in circuit_details_box.js
  var endpoint_table = summary_init();

  var nddi_map = new NDDIMap("map", session.data.interdomain == 1);

  //legend_init(nddi_map, false, true);

  nddi_map.showDefault();

  nddi_map.on("loaded", function(){
          this.updateMapFromSession(session, session.data.interdomain == 1);

          if (session.data.interdomain == 1){
              this.getInterDomainPath(session.data.circuit_id, YAHOO.util.Dom.get("interdomain_path_status"));
          }

      });
  if(session.data.backup_links.length > 0){
      var change_path_button = new YAHOO.widget.Button("change_path_button", {label: "Change Path"});
      change_path_button.on("click", function(){
	      showConfirm("Doing this may cause a disruption in traffic.  Are you sure?",
			  function(){
			      change_path_button.set("disabled",true);
			      var ds = new YAHOO.util.DataSource("services/provisioning.cgi?action=fail_over_circuit&circuit_id=" + session.data.circuit_id + "&workgroup_id=" + session.data.workgroup_id);
			      ds.responseType = YAHOO.util.DataSource.TYPE_JSON;
			      
			      ds.connTimeout    = 30 * 1000; // 30 seconds
			      
			      ds.responseSchema = {
				  resultsList: "results",
				  fields: [{key: "success", parser: "number"},
			      {key: "circuit_id", parser: "number"}
					   ],
				  metaFields: {
				      error: "error",
				      warning: "warning"
				  }
			      };
			      ds.sendRequest("",{success: function(){
				  change_path_button.set("disabled",false);
				  alert('Successfully changed the path',function(){window.location.reload()});
					  
				      },
					  failure: function(){
					      change_path_button.set("disabled",false);
					  alert('Unable to change to the backup path');
				      }},ds);
			      
			  },
			  function(){
			      //do nothing
			  });
	      
	  });
  }

  var edit_button = new YAHOO.widget.Button("edit_button", {label: "Edit Circuit"});

  edit_button.on("click", function(){

	  session.data.interdomain = 0;

	  var endpoints = [];

	  for (var i = 0; i < session.data.endpoints.length; i++){
	      if (session.data.endpoints[i].local == 1){
		  endpoints.push(session.data.endpoints[i]);
	      }
	  }

	  if (endpoints.length < 2){
	      for (var i = 0; i < session.data.passthrough.length; i++){
		  if (session.data.passthrough[i].local == 1){
		      endpoints.push(session.data.passthrough[i]);
		  }
	      }
	  }

	  session.data.endpoints = endpoints;

	  session.save();

	  window.location = "?action=edit_details";
      });

  var remove_button = new YAHOO.widget.Button("remove_button", {label: "Remove Circuit"});

  remove_button.on("click", function(){

	  window.location = "?action=remove_scheduling";
      });


  // show the edit interdomain stuff if we're an interdomain circuit
  if (session.data.interdomain == 1){

      var edit_interdomain = new YAHOO.widget.Button("edit_interdomain_button", {label: "Edit Interdomain"});

      edit_interdomain.on("click", function(){
	      window.location = "?action=edit_details";
	  });

  }
  else {
      YAHOO.util.Dom.get("edit_interdomain_button").parentNode.style.display = "none";
  }

    var reprovision_button = new YAHOO.widget.Button("reprovision_button", {label: "Force Reprovision" });

    reprovision_button.on("click", function(){
	showConfirm("Doing this may cause a disruption in traffic.  Are you sure? ", 
		    function(){
			reprovision_button.set('disabled',true);
	
			var circuit_id= session.data.circuit_id;
			var workgroup_id = session.data.workgroup_id;
			
			var ds = new YAHOO.util.DataSource("services/provisioning.cgi?action=reprovision_circuit&circuit_id="+circuit_id+"&workgroup_id="+workgroup_id);
			ds.responseType = YAHOO.util.DataSource.TYPE_JSON;
			ds.responseSchema = {
			    resultsList: "results",
			    fields: [
				{key: "success", parser: "number"},
		    
			    ],
			    metaFields: {
				error: "error",
				warning: "warning"
			    }
			};

			ds.sendRequest("", { 
			    success: function(req, resp){ 
				reprovision_button.set('disabled',false);
				alert("Successfully reprovisioned circuit");
				
		    
			    },
			    failure: function(req, resp){
				reprovision_button.set('disabled',false);
				alert("Failed to reprovision circuit, please try again later or contact your systems administrator if this continues");
			    }
			});

		    },
		    function(){ 
			//do nothing
		    }
		   );
    });

    

  var tabs = new YAHOO.widget.TabView("details_tabs");

  var graph = setupMeasurementGraph();

  nddi_map.on("clickNode", function(e, args){

		var node = args[0].name;

		var valid_node = false;
		// make sure this node is part of the circuit
		for (var i = 0; i < session.data.endpoints.length; i++){
		  if (session.data.endpoints[i].node == node){
		    valid_node = true;
		  }
		}

		// if they clicked on some random node not part of the circuit just ignore it
		  //if (! valid_node) return;

		if (graph.updating){
		  clearTimeout(graph.updating);
		}

		graph.options.node      = node;
		graph.options.interface = null;
		graph.options.link      = null;

		graph.render();
	      });

  nddi_map.on("clickLink", function(e, args){
		var link = args[0].name;

		if (graph.updating){
		  clearTimeout(graph.updating);
		}

		graph.options.link      = link;
		graph.options.interface = null;
		graph.options.node      = null;

		graph.render();
	      });

  setupScheduledEvents();

  setupHistory();
  setupCLR();
  // we can poll the map to show intradomain status updates unless we're interdomain
  if (session.data.interdomain == 0){
      setInterval(function(){

	      var ds = make_circuit_details_datasource();

	      ds.sendRequest("", {success: function(req, resp){
			  var details = resp.results[0];

			  save_session_from_datasource(details);

			  for (var i = 0; i < session.data.endpoints.length; i++){
			      nddi_map.removeNode(session.data.endpoints[i].node);
			  }

			  nddi_map.updateMapFromSession(session, true);
		      },
			  failure: function(req, resp){

		      }
		  });


	  }, 10000);
  }

}

function setupMeasurementGraph(){

    var date = new Date();

    var now  = date.valueOf() / 1000;

    var then = now - 600;

    var graph = new MeasurementGraph("traffic_graph",
				     "traffic_legend",
				     {
					 title:      session.data.description,
					 title_div:    YAHOO.util.Dom.get("traffic_title"),
					 circuit_id: session.data.circuit_id,
					 start:      then,
					 end:        now
				     }
				     );

    var time_select = new YAHOO.util.Element(YAHOO.util.Dom.get("traffic_time"));
    time_select.on("change", function(){
	    var new_start = this.get('element').options[this.get('element').selectedIndex].value;
	    var date = new Date();
	    graph.options.end   = date.valueOf() / 1000;
	    graph.options.start = graph.options.end - new_start;
	    graph.render();
	});

    return graph;
}

function setupScheduledEvents(){


    var ds = new YAHOO.util.DataSource("services/data.cgi?action=get_circuit_scheduled_events&circuit_id="+session.data.circuit_id);
    ds.responseType = YAHOO.util.DataSource.TYPE_JSON;

    ds.responseSchema = {
	resultsList: "results",
	fields: [
    {key: "username"},
    {key: "scheduled"},
    {key: "activated"},
    {key: "action"},
    {key: "layout"},
    {key: "completed"}
		 ]
    };

    var cols = [{key: "username", label: "By", width: 101},
		{key: "scheduled", label: "Scheduled", width: 122},
		{key: "action", label: "Action", width: 100, formatter: function(elLiner,oRec,oCol,oData){
			var txt = oRec.getData('layout');
			//browsers that don't suck
			if(window.DOMParser){
			    parser = new DOMParser();
			    xmlDoc = parser.parseFromString(txt,"text/xml");
			    
			}
			//IE
			else{
			    xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
			    xmlDoc.async=false;
			    xmlDoc.loadXML(txt);
			}

			var opt = xmlDoc.childNodes[0];
			elLiner.innerHTML = opt.attributes.action.value;
		    }},
		{key: "activated", label: "Activated", width: 121},
		{label: "Completed", formatter: function(el, rec, col, data){
			if (rec.getData('completed')){
			    el.innerHTML = "Yes";
			}
			else {
			    el.innerHTML = "No";
			}
		    }
		}
		];

    var config = {
	height: "255px"
    };

    var table = new YAHOO.widget.ScrollingDataTable("scheduled_events_table", cols, ds, config);

    table.subscribe("rowMouseoverEvent", table.onEventHighlightRow);
    table.subscribe("rowMouseoutEvent", table.onEventUnhighlightRow);

    table.subscribe("rowClickEvent", function(oArgs){
	    var record = this.getRecord(oArgs.target);
	    if (! record) return;
	    var region = YAHOO.util.Dom.getRegion(oArgs.target);
	    showActionPanel(record, [region.left, region.top]);
	});

    return table;
}

function setupCLR(){
    var ds = new YAHOO.util.DataSource("services/data.cgi?action=generate_clr&circuit_id=" + session.data.circuit_id);
    ds.responseType = YAHOO.util.DataSource.TYPE_JSON;
    
    ds.responseSchema = {
	resultsList: "results",
	fields: [{key: "clr"}]
    };

    ds.sendRequest('',{success: function(Req,Resp){
		var data = Resp.results;
		if(data.length == 1){
		    YAHOO.util.Dom.get("CLR_table").innerHTML = "<pre>" + data[0].clr;
		}else{
		    YAHOO.util.Dom.get("CLR_table").innerHTML = "Error occured fetching CLR data.  Error: " + data.error;
		}
	    },
		failure: function(Req,Resp){
		//do something
	    }});

}

function setupHistory(){

    var ds = new YAHOO.util.DataSource("services/data.cgi?action=get_circuit_history&circuit_id=" + session.data.circuit_id);
    ds.responseType = YAHOO.util.DataSource.TYPE_JSON;

    ds.responseSchema = {
	resultsList: "results",
	fields: [{key: "fullname"},
                 {key: "scheduled"},
                 {key: "activated"},
                 {key: "layout"},
                 {key: "completed"}
		 ]
    };

    var cols = [{key: "fullname", label: "By", width: 121},
		{key: "activated", label: "Scheduled On", width: 142},
		{key: "completed", label: "Done On", width: 141},
		{key: "event", label: "Event", width: 140}
		];

    var config = {
	height: "255px"
    };

    var table = new YAHOO.widget.ScrollingDataTable("history_table", cols, ds, config);

    table.subscribe("rowMouseoverEvent", table.onEventHighlightRow);
    table.subscribe("rowMouseoutEvent", table.onEventUnhighlightRow);

    table.subscribe("rowClickEvent", function(oArgs){
	    var record = this.getRecord(oArgs.target);
	    if (! record) return;
	    var region = YAHOO.util.Dom.getRegion(oArgs.target);
	    showActionPanel(record, [region.left, region.top]);
	});

    return table;

}


YAHOO.util.Event.onDOMReady(init);

</script>
