/** Sends a file to the API with its upload progress (fetch can't show upload progress), and the API's answer back.
 *  kind: what is being sent, for the messages ("video", "picture"). */
export function sendFile<T>(method: 'POST' | 'DELETE', url: string, body: FormData | null, token: string | null,
  progress: (done: number) => void, kind = 'file'): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (token) x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.upload.onprogress = (e) => { if (e.lengthComputable) progress(e.loaded / e.total); };
    x.onload = () => {
      let data: { message?: string | string[] } = {};
      try { data = JSON.parse(x.responseText || '{}'); } catch { /* not JSON */ }
      if (x.status >= 200 && x.status < 300) return resolve(data as unknown as T);
      const m = data.message;
      const text = x.status === 413
        ? `That ${kind} is too big. Make it smaller (under 500 MB), or raise MAX_UPLOAD_MB in api/.env.`
        : Array.isArray(m) ? m.join(' ') : m || `The upload didn't work (error ${x.status}). Please try again.`;
      reject(new Error(x.status === 401 ? `Your admin log-in has ended. Log in again, then try the ${kind} again.` : text));
    };
    x.onerror = () => reject(new Error(`The ${kind} couldn't be sent: the API isn't reachable. Check that the API is running, then try again.`));
    x.send(body);
  });
}
