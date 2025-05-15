FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY tsconfig.json ./
COPY src ./src

# 빌드
RUN npm run build

FROM node:20-alpine AS release

WORKDIR /app

# 빌드된 파일과 package.json 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
ENV NODE_ENV=production
RUN npm ci --omit=dev

# 서버 실행
ENTRYPOINT ["node", "dist/index.js"]