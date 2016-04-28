/* This code needs some refactoring
 * Hell isn't other people, hell is javascript.
 *
 */

var trace =[]; // Holds the trace tree
var tree; // Holds the call tree

// nodenames to be excluded
var omit_list = ['__fentry__', '#','__stack_chk_fail'];

var depth = 1;
var node_depth ;
var node_height ;
//e.g. tree.html?json=sys_kexec_file_load_callees-trace.json&depth=4&x=8&y=200
console.log(node_height);
console.log(node_depth);

var m = [20, 120, 20, 120],
    w = 80000 - m[1] - m[3], // TODO: adjust h & w to svg size
    h = 80000 - m[0] - m[2],
    i = 0;


var diagonal = d3.svg.diagonal()
    .projection(function(d) {
        return [d.y, d.x];
    });

var vis = d3.select("#tree").append("svg:svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .attr("id", "treesvg")
    .style("overflow", "auto")
    .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");


var gdict = [];
var root;

// Copy all node info into the 'gdict' lookup table
// We use this table to expand "copied" and "duplicate" nodes
// when they are toggled
function node_to_dict(node) {
    // if a child nodename is in the omit_list it shouldn't be displayed
    // we remove it from the children but we still need to process its
    // children
    omit_list.forEach(function(f) {
        if (node.children) {
            filtered = [];
            node.children.forEach(function(c) {
                if (c.label != f) {
                    filtered.push(c);
                }
                else{
                    node_to_dict(c);
                }
            });
            node.children = filtered;
        }
    });
    children = node.children ? node.children : []; 

    children.forEach(function(child) {
        if (child.type == "original") {
            node_to_dict(child);
        }
    });
    copy = JSON.parse(JSON.stringify(node));
    copy._children = copy.children;
    copy.children = null;
    gdict[node.name] = copy;
}

function init(x,y) {
    node_depth  = x;
    node_height = y;
    // Show the spinner while the tree is drawn
    $("#loading").show();
    // Tree depth
    depth = getParameterByName('depth') ? getParameterByName('depth') : 3;
    if(!depth){
        depth = $("input[name='depth']").val();
    }
    depth = parseInt(depth) ;
    $("input[name='depth']").val(depth + 1)
    tree = d3.layout.tree();

    if (getParameterByName('trace')){
        trace_f = '/json/' + getParameterByName('trace');
        d3.json(trace_f, function(error, tree) {
            if(tree){
                trace = tree;
            }
        });
    }

    var json_f = getParameterByName('json') ? getParameterByName('json') : 'sys_chdir.json' ;
    json_f = '/json/' + json_f;
    d3.json(json_f, function(error, tree) {

        root = tree;
        // root initialized above with the html
        root.x0 = h / 2;
        root.y0 = 0;

        function toggleAll(d) {
            if (d.children && d.children != []) {
                d.children.forEach(toggleAll);
                toggle(d);
            } else {
                delete d['children'];
                delete d['_children'];
            }
        }

        node_to_dict(root);
        // hide all nodes
        root.children.forEach(toggleAll);
        update(root);
        toggle_to(root,depth);
        goto_node(root);
    });
}

function toggle_to(node,depth){
    if (depth <= 0 ){ 
        return;
    }
    children = node.children ? node.children : node._children;
    if ( ! children ){
        return;
    }
    children.forEach(function(c){
        toggle(c);
        update(c);
        toggle_to(c,depth - 1);
    });
}

function goto_node(node){
    w = window.innerWidth ;
    h = window.innerHeight / 2;
    window.scrollTo(node.y , node.x - h);
}

function resize(direction, pm) {
    size = tree.size();
    if (direction == 'x') {
        factor = node_height > 5 ? 3 : 1; 
        node_height += pm == '+' ? factor : -factor;
        node_height = node_height < 2 ? 1 : node_height;
    }
    if (direction == 'y') {
        node_depth += pm == '+' ? 20 : -20
    }
    update(tree);
    goto_node(root);
}

// return path from root of tree to node
function get_path(node){
    if(node.parent){
        path = get_path(node.parent)
        path.push( node.label );
        return path;
    }
    return [node.label];
}


// Retrieve url parameter values
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
function has_children(node) {
    original = gdict[node.label];
    if (original && original._children && original._children.length > 0) {
        return true;
    }
    return false;
}

function is_collapsed(node){
    if ( ! has_children(node) ){
        return false;
    }
    original = gdict[node.label];
    return original.children ? false : true ;
}
        
// TODO : use css classes instead of hardcoded colors
function node_color(node) {
    if (node.type == "duplicate" || node.type == "copy") {
        if (node.children){
            return "white";
        }
        if (is_collapsed(node)) {
            return "lightsteelblue";
        } else {
            return "darksalmon";
        }
    }
    if (node._children && has_children(node) ) {
        return "lightsteelblue";
    }
    return "white";
}

// Check if a node is in the trace tree
// TODO: optimize
function is_traced(node){
    path   = get_path(node);
    traced = trace;
    if( ! traced || ! traced.children ){
        return false;
    }
    for (var i = 1 ; i <= path.length; i++ ){
        for (var j = 0 ; j <= traced.children.length;j++){
            if(j >= traced.children.length ){
                return false;
            }
            if(path[i] == traced.children[j].label){
                traced = traced.children[j];
                break;
            }
        }
        if (node.label == traced.label){
            return true;
        }
    }
    return false;
}

// CSS class of traced links
function get_link_class(link){
    pclass = "link";
    if(is_traced(link.target)){
        pclass += " trace";
    }
    return pclass;
}

// D3 update function
function update(source) {

    var duration = d3.event && d3.event.altKey ? 5000 : 500;

    // Compute the new tree layout.
    var levelWidth = [1];
    var childCount = function(level, n) {

        if (n.children && n.children.length > 0) {
            if (levelWidth.length <= level + 1) levelWidth.push(0);

            if (level > depth) {
                depth = level;
            }
            levelWidth[level + 1] += n.children.length + level * 1.5;
            n.children.forEach(function(d) {
                childCount(level + 1, d);
            });
        }
    };
    childCount(0, root);

    var newHeight = d3.max(levelWidth) * node_height; // 20 pixels per line

    if(! tree.cust_size){
        tree = tree.size([newHeight, depth * 10]);
    }

    var nodes = tree.nodes(root).reverse();

    if(! tree.cust_size){
        nodes.forEach(function(d) {
            d.y = d.depth * node_depth;
        });
    }

    tree.cust_size = false;

    // Update the nodes.
    var node = vis.selectAll("g.node")
        .data(nodes, function(d) {
            return d.id || (d.id = ++i);
        });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .attr("transform", function(d) {
            return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .on("click", function(d) {
            toggle(d);
            update(d);
            console.log(get_path(d));
            //goto_node(d);
        });

    nodeEnter.append("svg:circle")
        .attr("r", 1e-6)
        .style("fill", node_color);

    nodeEnter.append("svg:text")
        .attr("x", function(d) {
            return has_children(d) ? -10 : 10;
        })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) {
            return has_children(d) ? "end" : "start";
        })
        .text(function(d) {
            return d.label;
        })
        .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + d.y + "," + d.x + ")";
        });

    nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", node_color);

    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    // Update the links.
    var link = vis.selectAll("path.link")
        .data(tree.links(nodes), function(d) {
            return d.target.id;
        });

    // Enter any new links at the parent's previous position.
    link.enter().insert("svg:path", "g")
        .attr("class", get_link_class)
        //.attr("class", "link")
        .attr("d", function(d) {
            var o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
            var o = {
                x: source.x,
                y: source.y
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
    $("#loading").hide();
}


// Toggle children.
function toggle(d) {

    function set_dup(node) {
        node.type = 'duplicate';
        node._children = node.children;
        node.children = null;
    }

    function copy_original(node) {
        if (node.type == 'duplicate') {
            original = gdict[node.label];
            node.type = "copy";
            if (!original || !original._children) {
                console.log('ERR: NO ORIGINAL for ' + node.label);
                console.log(node);
                return;
            }
            children = JSON.parse(JSON.stringify(original._children));
            children.forEach(set_dup);
            node.x_children = children == [] ? null : children;
        }
    }

    if (d.type == "duplicate") {
        copy_original(d);
        d.children = d.x_children;
    } else if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
}


///////// Spinner 
var opts = {
    lines: 13, // The number of lines to draw
    length: 7, // The length of each line
    width: 4, // The line thickness
    radius: 10, // The radius of the inner circle
    rotate: 0, // The rotation offset
    color: 'steelblue', // #rgb or #rrggbb
    speed: 1, // Rounds per second
    trail: 60, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: 'auto', // Top position relative to parent in px
    left: 'auto' // Left position relative to parent in px
};
var spinner = new Spinner(opts).spin();
$("#loading").append(spinner.el);
///////// End Spinner

node_height = getParameterByName('y') ? getParameterByName('y') : 20;
node_depth  = getParameterByName('x') ? getParameterByName('x') : 100;
init(node_depth,node_height); // Draw the tree
//$("#control").draggable();

// Cause enter on the depth to expand
$("#depth").keyup(function(event){
    if(event.keyCode == 13){
        $("#expand").click();
    }
});
