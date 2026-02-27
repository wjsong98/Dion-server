/* [Server] Dion - Digital Warmth Signaling */
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" },
  pingTimeout: 30000
});

const roomUsers = {}; // 방별 접속자 명단

app.get("/", (req, res) => res.send("Dion Server is Running!"));

io.on("connection", (socket) => {
  // 1. 입장 (지각생 처리 포함)
  socket.on("join_room", ({ room, nickname }) => {
    socket.join(room);
    socket.data.room = room;
    socket.data.nickname = nickname;

    // 방에 기존 사람이 있다면? -> 방장에게 시간 물어보기
    if (roomUsers[room] && roomUsers[room].length > 0) {
      const leader = roomUsers[room][0].id;
      io.to(leader).emit("request_time", { requesterId: socket.id });
    }

    // 명단 등록
    if (!roomUsers[room]) roomUsers[room] = [];
    roomUsers[room].push({ id: socket.id, nickname: nickname });

    // 알림 전송
    io.to(room).emit("user_list_update", roomUsers[room]);
    io.to(room).emit("log_message", { type: "system", text: `👋 ${nickname}님이 온기를 나눕니다.` });
  });

  // 2. 시간 정보 중계 (기존 유저 -> 지각생)
  socket.on("reply_time", (data) => {
    io.to(data.requesterId).emit("sync_on_join", { time: data.time, state: data.state });
  });

  // 3. 동기화 (재생/정지/탐색)
  socket.on("sync_action", (data) => {
    socket.to(data.room).emit("perform_action", { ...data, nickname: socket.data.nickname });
  });

  // 4. 소환 / URL 변경
  socket.on("change_url", (data) => {
    socket.to(data.room).emit("redirect_url", { ...data, nickname: socket.data.nickname });
  });

  // 5. 이모지
  socket.on("send_emoji", (data) => {
    socket.to(data.room).emit("show_emoji", { emoji: data.emoji, nickname: socket.data.nickname });
  });

  // 6. 퇴장
  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (room && roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter(user => user.id !== socket.id);
      io.to(room).emit("user_list_update", roomUsers[room]);
      io.to(room).emit("log_message", { type: "system", text: `💨 ${socket.data.nickname}님이 나갔습니다.` });
      if (roomUsers[room].length === 0) delete roomUsers[room];
    }
  });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log("Server running on port " + port);
});
