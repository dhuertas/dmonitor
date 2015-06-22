var webSocketAddr = "ws://" + window.location.hostname + ":8080";

var connection = new WebSocket(webSocketAddr);

var dCharts = {};

var dataDuration = 3600;

window.onload = function() {

  document.getElementById("interval").addEventListener("change", function(e) {
    dataDuration = parseInt(e.target.value);
    clear();
    connection.send(JSON.stringify({ cmd: 'restart' }));
  }, false);
}

connection.onopen = function() {

}

connection.onerror = function(error) {
  var p = document.createElement("p");
  p.innerHTML = "Oops!";
  document.getElementById("console").appendChild(p);
}

connection.onmessage = function(message) {

  var json = {};

  try {
    json = JSON.parse(message.data);
  } catch (e) {
    console.log("Unable to parse JSON data");
    return;
  }

  if (typeof dCharts[json.sn] == "undefined") {
    dCharts[json.sn] = {};
    plot(json);
  } else {
    update(json);
  }
}

var plot = function(json) {

  var chart = dCharts[json.sn];

  chart["margin"] = { top: 20, right: 20, bottom: 30, left: 50 };
  chart["width"] = 960 - chart.margin.left - chart.margin.right;
  chart["height"] = 500 - chart.margin.top - chart.margin.bottom;

  chart["x"] = d3.time.scale()
      .range([0, chart.width]);

  chart["y"] = d3.scale.linear()
      .range([chart.height, 0]);

  chart["xAxis"] = d3.svg.axis()
      .scale(chart.x)
      .orient("bottom");

  chart["yAxis"] = d3.svg.axis()
      .scale(chart.y)
      .orient("left");

  chart["line"] = d3.svg.line()
      .x(function(d) { return chart.x(d.date); })
      .y(function(d) { return chart.y(d.value); });

  chart["svg"] = d3.select("#charts").append("svg")
      .attr("width", chart.width + chart.margin.left + chart.margin.right)
      .attr("height", chart.height + chart.margin.top + chart.margin.bottom)
    .append("g")
      .attr("transform", "translate(" + chart.margin.left + "," + chart.margin.top + ")");

  json["date"] = new Date(json.ts*1000);
  json.value = parseFloat(json.value);

  chart.data = [];
  chart.data.push(json);

  chart["max"] = d3.max(chart.data, function(d) { return d.value; });

  chart.x.domain(d3.extent(chart.data, function(d) { return d.date; }));
  chart.y.domain([0, chart.max]);

  chart.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + chart.height + ")")
    .call(chart.xAxis);

  chart.svg.append("g")
    .attr("class", "y axis")
    .call(chart.yAxis)
  .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text(json.sn);

  chart.svg.selectAll(".y.axis").transition().duration(1500).call(chart.yAxis);
  chart.svg.selectAll(".x.axis").transition().duration(1500).call(chart.xAxis);

  chart.svg.append("path")
      .datum(chart.data)
      .attr("class", "line")
      .attr("d", chart.line);
}

function update(json) {

  var chart = dCharts[json.sn];

  // clean data older than "duration"
  var lastTimestamp = json.ts,
    firstTimestamp = chart.data[0].ts;

  while (lastTimestamp - firstTimestamp > dataDuration) {
    chart.data.splice(0, 1);
    firstTimestamp = chart.data[0].ts;
  }

  json["date"] = new Date(json.ts*1000);
  json.value = parseFloat(json.value);

  chart.data.push(json);

  if (json.value > chart.max) {
    chart.max = json.value;
  }

  chart.x.domain(d3.extent(chart.data, function(d) { return d.date; }));
  chart.y.domain([0, chart.max]);

  chart.svg.select("g.x.axis").transition().duration(1500).call(chart.xAxis);
  chart.svg.select("g.y.axis").transition().duration(1500).call(chart.yAxis);

  var lines = chart.svg.selectAll(".line").datum(chart.data).attr("class", "line");

  lines.attr("d", chart.line);
}

function clear() {

  var svgs = document.getElementsByTagName("svg");

  while (svgs.length > 0) { 
    svgs[0].parentNode.removeChild(svgs[0]);
  }

  for (var chart in dCharts) {
    if (dCharts.hasOwnProperty(chart)) {
      dCharts[chart] = undefined; 
    }
  }
}
