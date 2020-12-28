var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 8081;

var rcon = require('./rcon')

// 静态资源
app.use('/assets', express.static('assets'));
 
// 主页面
app.get('/', function (req, res) {
    res.sendFile( __dirname + "/" + "index.html" );
})

global.mapping = {};

io.on('connection', (socket) => {
  socket.on('login', function(data) {
    var id = data.id;

    global.mapping[socket.id] = id;

    if(!global[id]) {
      global[id] = {index: 1};
    } else {
      destoryConnection(id);
      global[id].index = global[id].index + 1;
    }

    global[id][global[id].index] = {auth: false, connect: false, rcon: null};

    global[id][global[id].index].rcon = new rcon(data.ip, data.port, data.password, {id: id});
    global[id][global[id].index].rcon.on('response', ResponseHandler);
    global[id][global[id].index].rcon.connect();
  });

  socket.on('command', function(data) {
    var id = data.id, cmd = data.cmd;

    if(isLogged(id)) {
      global[id][global[id].index].rcon.send(cmd);
    } else {
      io.emit('logged-' + id, false);
    }
  });
  
  socket.on('disconnect', () => {
    var id = global.mapping[socket.id];
    
    if(id) {
      destoryConnection(id);
      delete global.mapping[socket.id];
    }
  });
});

var isLogged = function(id) {
  return global[id] && global[id][global[id].index] && global[id][global[id].index].rcon && global[id][global[id].index].auth;
}

var destoryConnection = function(id) {

  if(id && global[id][global[id].index] && global[id][global[id].index].rcon) {
    global[id][global[id].index].rcon.disconnect();
    delete global[id][global[id].index];
  }
}

var ResponseHandler = function(res) {
  var clientId = res.id;
  var data = res.data;
  
  if(!global[clientId]) {
    return;
  }
  
  // 登录数据包, 只有成功登录后才会有数据返回, 否则只有异常
  if(global[clientId] && global[clientId][global[clientId].index] && !global[clientId][global[clientId].index].auth) {
    global[clientId][global[clientId].index].auth = true;
    io.emit('logged-' + clientId, true);
  } else if(data.indexOf('Client List :') > -1) {
    var list = data.replace('\0','').replace('Client List :\n','').split('\n');
    var result = [];
    
    if(!(list.length == 1 && list[0] == "Server is empty !")) {
      for (const key in list) {
        var str = list[key].trim();
  
        if(str && str != '') {
          var idx = str.indexOf(' ');
          var id = str.substr(0, idx);
          var name = str.substr(idx + 1);
          
          if(name.length > 19) {
            name = name.substring(0, 19) + '...';
          }

          result.push({id, name});
        }
      }
    }
    
    io.emit('show-player-list-' + clientId, result);
  } else {
  }
}

http.listen(port, function(){
  console.log('listening on *:' + port);
});