import type { Metadata } from "next";
import { DevicePreview } from "./DevicePreview";

export const metadata: Metadata = { title: "기기별 미리보기" };

// 휴대폰, 패드, 노트북에서 어떻게 보이는지 한 화면에서 확인한다.
export default function PreviewPage() {
  return <DevicePreview />;
}
