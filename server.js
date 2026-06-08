const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {}; 
let gameState = 'lobby'; 
let roundMode = 'score'; // 'score' 또는 'betting'

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        if (name === 'DISPLAY') {
            socket.join('display'); 
        } else {
            const isActive = (gameState === 'lobby' || gameState === 'reveal');
            
            // ⭐ 중간 합류 시 현재 모드에 따라 기본 점수 다르게 지급
            let initialScore = 0;
            if (roundMode === 'betting') initialScore = 100;

            players[socket.id] = { 
                name: name, 
                fingers: null, 
                betTotal: null, 
                betAmount: 0, 
                score: initialScore, 
                active: isActive 
            };
            io.emit('updatePlayers', players, roundMode);
            socket.emit('phaseChange', gameState, players, roundMode);
        }
    });

    // ⭐ 최초 게임 시작 (모드 선택)
    socket.on('startGame', (mode) => {
        gameState = 'input_fingers';
        roundMode = mode || 'score';
        
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            players[id].betAmount = 0;
            players[id].active = true; 
            // ⭐ 모드에 따른 초기 점수 세팅
            players[id].score = (roundMode === 'score') ? 0 : 100;
        }
        io.emit('phaseChange', gameState, players, roundMode);
    });

    // ⭐ 다음 라운드 시작 (기존 점수 유지, 모드 유지)
    socket.on('nextRound', () => {
        gameState = 'input_fingers';
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            players[id].betAmount = 0;
            players[id].active = true; // 대기자 합류
        }
        io.emit('phaseChange', gameState, players, roundMode);
    });

    // ⭐ 게임 완전히 종료 (로비로 돌아감, 점수 초기화)
    socket.on('endGame', () => {
        gameState = 'lobby';
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            players[id].betAmount = 0;
            players[id].score = 0; 
            players[id].active = true;
        }
        io.emit('phaseChange', gameState, players, roundMode);
    });

    socket.on('submitFingers', (num) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].fingers = num;
            io.to('display').emit('playerUpdated', players, roundMode);

            const activePlayers = Object.values(players).filter(p => p.active);
            const allSubmitted = activePlayers.every(p => p.fingers !== null);
            
            if (allSubmitted && activePlayers.length > 0) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players, roundMode);
            }
        }
    });

    socket.on('submitBet', (data) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].betTotal = data.total;
            players[socket.id].betAmount = data.amount || 0;
            
            io.to('display').emit('playerUpdated', players, roundMode);

            const activePlayers = Object.values(players).filter(p => p.active);
            const allBet = activePlayers.every(p => p.betTotal !== null);
            
            if (allBet && activePlayers.length > 0) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                
                for (let id in players) {
                    if (players[id].active) {
                        const p = players[id];
                        if (roundMode === 'score') {
                            if (p.betTotal === trueTotal) p.score += 1;
                        } else if (roundMode === 'betting') {
                            if (p.betTotal === trueTotal) {
                                p.score += p.betAmount * 2; 
                            } else {
                                p.score -= p.betAmount; 
                            }
                        }
                    }
                }
                io.emit('revealResult', { players, trueTotal, roundMode });
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players, roundMode);
        
        const activePlayers = Object.values(players).filter(p => p.active);
        if (activePlayers.length > 0) {
            if (gameState === 'input_fingers' && activePlayers.every(p => p.fingers !== null)) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players, roundMode);
            } else if (gameState === 'betting' && activePlayers.every(p => p.betTotal !== null)) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                
                for (let id in players) {
                    if (players[id].active) {
                        if (roundMode === 'score' && players[id].betTotal === trueTotal) {
                            players[id].score += 1;
                        } else if (roundMode === 'betting') {
                            if (players[id].betTotal === trueTotal) players[id].score += players[id].betAmount * 2;
                            else players[id].score -= players[id].betAmount;
                        }
                    }
                }
                io.emit('revealResult', { players, trueTotal, roundMode });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`서버가 ${PORT}포트에서 실행 중입니다.`); });
