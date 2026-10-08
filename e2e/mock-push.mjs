// 테스트 전용: 브라우저 푸시 서버 흉내. /ok 는 201, /gone 은 410(구독 만료)을 돌려준다.
import fs from "node:fs";
import https from "node:https";

const dir = process.argv[2];
const log = [];
https
  .createServer({ key: fs.readFileSync(`${dir}/push-key.pem`), cert: fs.readFileSync(`${dir}/push-cert.pem`) }, (req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.url === "/log") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(log));
      }
      log.push({
        url: req.url,
        authorization: req.headers.authorization ?? "",
        encoding: req.headers["content-encoding"] ?? "",
        ttl: req.headers.ttl ?? "",
        bytes: Buffer.concat(chunks).length,
      });
      res.writeHead(req.url.startsWith("/gone") ? 410 : 201);
      res.end();
    });
  })
  .listen(54400, () => console.log("mock push on 54400"));
