const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {}; // 플레이어 데이터 { name, fingers, betTotal }
let gameState = 'lobby'; // lobby, input_fingers, betting, reveal

io.on('connection', (socket) => {
    // 1. 닉네임 입력 및 접속
    socket.on('join', (name) => {
        if (name === 'DISPLAY') {
            socket.join('display'); // 전광판은 따로 그룹화
        } else {
            players[socket.id] = { name: name, fingers: null, betTotal: null };
            io.emit('updatePlayers', players);
        }
    });

    // 2. 전광판에서 게임 시작 버튼 누름
    socket.on('startGame', () => {
        gameState = 'input_fingers';
        // 데이터 초기화
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
        }
        io.emit('phaseChange', gameState);
    });

    // 3. 플레이어가 손가락 개수(0~5) 제출
    socket.on('submitFingers', (num) => {
        if (players[socket.id]) players[socket.id].fingers = num;
        io.to('display').emit('playerUpdated', players);

        // 모두 제출했는지 확인
        const allSubmitted = Object.values(players).every(p => p.fingers !== null);
        if (allSubmitted && Object.keys(players).length > 0) {
            gameState = 'betting';
            io.emit('phaseChange', gameState);
        }
    });

    // 4. 플레이어가 예측값 베팅 제출
    socket.on('submitBet', (predictedTotal) => {
        if (players[socket.id]) players[socket.id].betTotal = predictedTotal;
        io.to('display').emit('playerUpdated', players);

        // 모두 베팅했는지 확인
        const allBet = Object.values(players).every(p => p.betTotal !== null);
        if (allBet && Object.keys(players).length > 0) {
            gameState = 'reveal';
            // 실제 손가락 총합 계산
            const trueTotal = Object.values(players).reduce((sum, p) => sum + p.fingers, 0);
            io.emit('revealResult', { players, trueTotal });
        }
    });

    // 접속 종료
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`핑거 주사위 서버가 ${PORT}포트에서 실행 중입니다.`);
});
