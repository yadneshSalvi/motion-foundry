"""Reproducible original feedback cues; no external audio or samples. CC0-1.0."""
from pathlib import Path
import hashlib,json,math,random,struct,wave
root=Path(__file__).resolve().parents[1]/'lens-src'/'audio'
root.mkdir(parents=True,exist_ok=True)
rate=48000
rng=random.Random(20261108)
clips={
 'crank-tick':(.065,lambda t:(.55*math.sin(2*math.pi*1900*t)+.28*math.sin(2*math.pi*3200*t)+.17*rng.uniform(-1,1))*math.exp(-t/0.009)),
 'contact':(.24,lambda t:(.72*math.sin(2*math.pi*(115*t-45*t*t))+.18*math.sin(2*math.pi*260*t)+.10*rng.uniform(-1,1))*math.exp(-t/0.055)),
 'clear':(.65,lambda t:(.46*math.sin(2*math.pi*784*t)+.31*math.sin(2*math.pi*1174.66*t)+.23*math.sin(2*math.pi*1568*t))*math.exp(-t/0.19)),
}
manifest={'license':'CC0-1.0','origin':'Original analytic waveforms, generated locally; no sampled or third-party audio.','generator':'scripts/generate-native-audio.py','sampleRateHz':rate,'channels':1,'files':[]}
for name,(duration,fn) in clips.items():
 count=round(duration*rate)
 samples=[fn(i/rate)*min(1,i/(rate*.002))*min(1,(count-1-i)/(rate*.008)) for i in range(count)]
 peak=max(abs(v) for v in samples)
 data=b''.join(struct.pack('<h',round(v/peak*.50*32767)) for v in samples)
 path=root/(name+'.wav')
 with wave.open(str(path),'wb') as out:
  out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes(data)
 manifest['files'].append({'file':path.name,'frames':count,'durationSeconds':count/rate,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(root/'LICENSE.txt').write_text('These original analytically synthesized feedback cues are dedicated to the public domain under CC0 1.0 Universal. No third-party recordings or samples were used. https://creativecommons.org/publicdomain/zero/1.0/\n')
print(json.dumps({'files':[x['file'] for x in manifest['files']],'totalFrames':sum(x['frames'] for x in manifest['files'])}))
