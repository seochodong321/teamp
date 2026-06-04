// 업로드 이미지를 클라이언트에서 축소 — 작게 표시되는 사진(아바타 등)이
// 원본 수 MB로 저장·전송되는 낭비 방지. 캔버스로 리샘플 후 JPEG로 재인코딩.
//
// 반환: 축소된 Blob(image/jpeg). 아래 경우엔 원본 file 그대로 반환:
//   - 이미지가 아님 / GIF(애니메이션 보존) / 처리 실패 / 결과가 원본보다 큼
export async function resizeImage(file, { maxSize = 320, quality = 0.85 } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.type === 'image/gif') return file

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = dataUrl
    })

    const longest = Math.max(img.width, img.height)
    const scale = Math.min(1, maxSize / longest)
    // 이미 작고(축소 불필요) 용량도 가벼우면 재인코딩 없이 원본 유지
    if (scale === 1 && file.size <= 200 * 1024) return file

    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // 투명 PNG가 JPEG에서 검게 변하는 것 방지 — 흰 배경 깔기
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file
    return blob.size < file.size ? blob : file
  } catch {
    return file  // 어떤 이유로든 실패하면 원본 업로드로 폴백
  }
}
