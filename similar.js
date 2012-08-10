var SAMPLE_API_KEY = "b25b959554ed76058ac220b7b2e0a026";
var BASE_URL = "http://ws.audioscrobbler.com/2.0/?";

var dataCalls = 0;
var loadingArtist;

function paramsToString(params) {
    return $.map(params, function(v, k) { return k + '=' + v; }).join('&');
}

function dataUrl(method, params, apiKey) {
    if (apiKey == null) apiKey = SAMPLE_API_KEY;
    var fullParams = {};
    $.extend(fullParams, params, { format: 'json', method: method, api_key: apiKey });
    return BASE_URL + paramsToString(fullParams);
}

function addArtistInfo(artist) {
    var params = {}
    if (artist.mbid) params.mbid = artist.mbid;
    else params.artist = artist.name;
    var toLoad = dataUrl("artist.getInfo", params);
    d3.json(toLoad, function(artistInfo) {
        if (artistInfo.artist) {
            artist.stats = { 
                listeners: parseInt(artistInfo.artist.stats.listeners),
                playcount: parseInt(artistInfo.artist.stats.playcount)
            };
        } else {
            artist.stats = {};
        }
        dataCallback();
    });
}

function dataCallback() {
    dataCalls--;
    if (dataCalls < 0) dataCalls = 0;
    updateStatus();
    if (dataCalls == 0) {
        $('#status').hide();
        $('#controls').show();
        bind();
    }
}

var width, height;

var svg = d3.select('#chart');

var color = d3.scale.category20();

var force = d3.layout.force().charge(-420);

var link = svg.selectAll('line.link');

var node = svg.selectAll('circle.node');

var linkScale = d3.scale.linear().domain([1,0]).range([40, 400]);

var linkDistance = function(link) {
    return linkScale(link.target.match);
}

var thicknessScale = d3.scale.linear().domain([0,1]).range([1, 5]);

var linkThickness = function(link) {
    return thicknessScale(link.target.match);
}

var nodeRadiusScale = d3.scale.linear().range([5, 50]);

var nodeRadius = function(artist) {
    return nodeRadiusScale(listeners(artist));
}

var nodeColorScale = d3.scale.linear().range([color(10), color(10)]);

var nodeColor = function(artist) {
    return nodeColorScale(playsPerListener(artist));
}

var nodeOpacityScale = d3.scale.linear().range([0, 1]);

var nodeOpacity = function(artist) {
    return nodeOpacityScale(playsPerListener(artist));
}

var nodes = [];
var links = [];

var history = [];

var maxRadius;

function listeners(artist) {
    return (artist.stats && artist.stats.listeners) ? artist.stats.listeners : 0;
}

function playsPerListener(artist) {
    return artist.stats && artist.stats.listeners && artist.stats.playcount ? artist.stats.playcount / artist.stats.listeners : 0;
}

function resize() {
    width = $(window).width();
    height = $(window).height() - $('#controls').height();

    maxRadius = Math.min(width, height) / 2.2;

    linkScale.range([maxRadius * 0.2, maxRadius]);

    force.size([width, height]);

    svg.attr('width', width)
    .attr('height', height)

    if (force) force.start();
}

function bind() {
    $('.link').remove();
    $('.node').remove();

    nodeRadiusScale.domain([0, d3.extent(nodes, listeners)[1]]);
    nodeColorScale.domain([0, d3.extent(nodes, playsPerListener)[1]]);
    nodeOpacityScale.domain([0, d3.extent(nodes, playsPerListener)[1]]);

    force.nodes(nodes)
        .links(links)
        .linkDistance(linkDistance);

    nodes[0].x = width / 2;
    nodes[0].y = height / 2;

    var n = nodes.length;
    nodes.slice(1).forEach(function(d, i) {
        var ang = Math.PI * i / n;
        d.x = Math.cos(ang) * maxRadius + width / 2;
        d.y = Math.sin(ang) * maxRadius + height / 2;
    });

    var linkEnter = link.data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .style('stroke-width', linkThickness)
        .style('stroke', "#999")
        .style('stroke-opacity', .6);

    var nodeEnter = node.data(nodes)
        .enter()
        .append('svg:g')
        .attr('class', 'node')
        .call(force.drag)
        .on('click', function(d) {
            loadSimilarArtists({ name: d.name || d.artist });
        });

    nodeEnter.append('circle')
        .attr('r', 15)
        .attr('fill', nodeColor)
        .attr('fill-opacity', nodeOpacity)
        .attr('r', nodeRadius);

    nodeEnter.append('text')
        .attr('class', 'artist')
        .text(function(artist) { return artist.name; });

    var fmt = d3.format(".2r");

    nodeEnter.append('text')
        .attr('y', 12)
        .attr('class', 'avgListens')
        .text(function(d) {
            //return d.stats && d.stats.listeners && d.stats.playcount ? fmt(d.stats.playcount / d.stats.listeners) + " plays / user" : "";
        });

    force.start();

    force.on('tick', function() {
        linkEnter.attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });

        nodeEnter.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });
}

function back() {
    if (history && history.length > 1) {
        history.pop();
        loadSimilarArtists(history.pop());
    }
}

function updateStatus() {
    $('#statusArtist').text('loading ' + loadingArtist.name + '...');
    /*
    if (dataCalls) 
        $('#statusSimilars').text("" + dataCalls + " remaining");
    */
}

function loadSimilarArtists(artist, limit) {
    params = { limit: limit || parseInt($('#limit').val()) , autocorrect: 1};
    if (artist.mbid) params.mbid = artist.mbid;
    else params.artist = artist.name;

    var toLoad=dataUrl("artist.getsimilar", params);
    dataCalls = 0;
    $('#controls').hide();
    $('#status').show();
    loadingArtist = artist;
    updateStatus();

    d3.json(toLoad, function(data){ 
        nodes = [];
        links = [];

        queriedArtist = { name: data.similarartists['@attr'].artist };
        history.push(queriedArtist);

        $('#artist').val(queriedArtist.name);

        nodes.push(queriedArtist);

        $.each(data.similarartists.artist, function(i, artist) {
            nodes.push(artist);
            links.push(
                { 
                    source: queriedArtist,
                    target: artist 
                });
        });

        dataCalls = nodes.length;

        $.each(nodes, function(i, artist) { addArtistInfo(artist); });
    });      
}

$(document).ready(function() {
    $('#limit').val(20);

    $('#graph').click(function() {
        var name = $('#artist').val();
        loadSimilarArtists({ name: name }); 
    });

    $('#back').click(back);

    $("#artist").keyup(function(event){
        if(event.keyCode == 13){
            $("#graph").click();
        }
    });

    $("#limit").keyup(function(event){
        if(event.keyCode == 13){
            $("#graph").click();
        }
    });

    $(window).resize(resize);

    resize();
});
