const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

app.get("/", (req, res) => res.send("🔥 Dion Server is Running!"));

const roomUsers = {};

io.on("connection", (socket) => {

  socket.on("join_room", ({ room, nickname }) => {
    socket.join(room);
    socket.data.room = room;
    socket.data.nickname = nickname;

    console.log(`[입장] ${nickname} → 방: ${room}`);

    if (roomUsers[room] && roomUsers[room].length > 0) {
      const leader = roomUsers[room][0].id;
      console.log(`[싱크요청] 리더 ${leader}에게 시간 요청`);
      io.to(leader).emit("request_time", { requesterId: socket.id });
    }

    if (!roomUsers[room]) roomUsers[room] = [];
    roomUsers[room].push({ id: socket.id, nickname: nickname });

    io.to(room).emit("user_list_update", roomUsers[room]);
    io.to(room).emit("log_message", { text: `👋 ${nickname}님이 입장했습니다.` });
  });

  socket.on("reply_time", (data) => {
    console.log(`[싱크응답] 시간 ${data.time} → ${data.requesterId}에게 전달`);
    io.to(data.requesterId).emit("sync_on_join", { time: data.time });
  });

  socket.on("sync_action", (data) => {
    socket.to(data.room).emit("perform_action", { ...data, nickname: socket.data.nickname });
  });

  socket.on("change_url", (data) => {
    socket.to(data.room).emit("redirect_url", { ...data, nickname: socket.data.nickname });
  });

  socket.on("send_emoji", (data) => {
    socket.to(data.room).emit("show_emoji", { ...data, nickname: socket.data.nickname });
  });

  socket.on("disconnect", () => {
    const { room, nickname } = socket.data;
    if (room && roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter((u) => u.id !== socket.id);
      io.to(room).emit("user_list_update", roomUsers[room]);
      io.to(room).emit("log_message", { text: `💨 ${nickname}님이 퇴장했습니다.` });
      if (roomUsers[room].length === 0) delete roomUsers[room];
    }
  });

});

const port = process.env.PORT || 3000;
http.listen(port, () => console.log(`Server running on port ${port}`));
