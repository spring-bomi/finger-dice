[ 핑거 주사위 눈치게임 (Finger Dice) ]

보드게임 '라이어스 다이스' 문법을 차용한 실시간 심리 베팅 게임 소스코드입니다.
- 참가자는 스마트폰에서 비밀리에 0~5개의 손가락을 제출하고 베팅을 진행합니다.
- 메인 전광판에서 실시간으로 모든 참가자의 상태(대기/완료/결과)를 중계합니다.
- Render 또는 로컬 환경 모두에서 즉시 배포/실행할 수 있도록 설정되어 있습니다.

■ 프로젝트 폴더 구조
finger-dice/
  ├── package.json
  ├── server.js
  ├── .gitignore
  └── public/
        ├── index.html     (플레이어 스마트폰용 화면)
        └── display.html   (메인 전광판용 화면)

■ 배포 및 실행 방법
1. 본 압축 파일을 해제하고, 이 폴더를 GitHub에 새로운 레포지토리로 올립니다.
2. Render.com 에 접속하여 해당 레포지토리를 연결해 배포합니다.
3. 배포된 주소가 `https://내주소.onrender.com` 이라면:
   - 전광판 화면: https://내주소.onrender.com/display.html
   - 참가자 화면: https://내주소.onrender.com
