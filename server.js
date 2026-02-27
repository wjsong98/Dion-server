const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

// 루트 경로 접속 시 상태 표시
app.get("/", (req, res) => res.send("🔥 Dion Server is Running!"));

const roomUsers = {}; // 방별 접속자 관리

io.on("connection", (socket) => {
  socket.on("join_room", ({ room, nickname }) => {
    socket.join(room);
    socket.data.room = room;
    socket.data.nickname = nickname;

    // 기존 접속자가 있다면 "현재 시간 알려줘" 요청
    if (roomUsers[room] && roomUsers[room].length > 0) {
      const leader = roomUsers[room][0].id;
      io.to(leader).emit("request_time", { requesterId: socket.id });
    }

    if (!roomUsers[room]) roomUsers[room] = [];
    roomUsers[room].push({ id: socket.id, nickname: nickname });

    io.to(room).emit("user_list_update", roomUsers[room]);
    io.to(room).emit("log_message", { text: `👋 ${nickname}님이 입장했습니다.` });
  });

  // 지각생 시간 동기화 처리
  socket.on("reply_time", (data) => {
    io.to(data.requesterId).emit("sync_on_join", { time: data.time });
  });

  // 영상 제어 (재생, 정지, 이동)
  socket.on("sync_action", (data) => {
    socket.to(data.room).emit("perform_action", { ...data, nickname: socket.data.nickname });
  });

  // 소환 (URL 변경)
  socket.on("change_url", (data) => {
    socket.to(data.room).emit("redirect_url", { ...data, nickname: socket.data.nickname });
  });

  // 이모지
  socket.on("send_emoji", (data) => {
    socket.to(data.room).emit("show_emoji", { ...data, nickname: socket.data.nickname });
  });

  // 퇴장 처리
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
