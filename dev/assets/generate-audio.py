"""Build file-based stadium audio. Recorded crowd: Gregor Quendel, CC BY 4.0.
Other cues are original, generated Foley-style effects, not field recordings.
Pass --source-directory with the three attributed source MP3s (see ASSETS.md).
"""
from pathlib import Path
import argparse, subprocess, tempfile
import numpy as np
from scipy.signal import butter,sosfilt
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/match-assets55'
p=argparse.ArgumentParser();p.add_argument('--source-directory',required=True);args=p.parse_args();source=Path(args.source_directory)
for number,name,duration in [('10','ambience',30),('04','crowd-goal',7),('05','crowd-chance',3)]:
    src=next(source.glob('* - '+number+' - *.mp3'))
    # PCM WAV deliberately retained for reliable local decoding and no codecs/CDN.
    fade='0.8' if name=='ambience' else '0.12'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-t',str(duration),'-ar','44100','-ac','2','-af',f'afade=t=in:d={fade},afade=t=out:st={duration-float(fade)}:d={fade},volume=0.7','-c:a','pcm_s16le',str(OUT/(name+'.wav'))],check=True)
rng=np.random.default_rng(5537);sr=44100
def save(name,duration,fn):
    t=np.arange(round(duration*sr))/sr;n=rng.normal(0,1,len(t));data=fn(t,n);data=np.clip(data,-.94,.94)
    wavfile.write(OUT/(name+'.wav'),sr,np.int16(data*32767))
def low(n,f):return sosfilt(butter(2,f,fs=sr,output='sos'),n)
for name,power in [('kick-soft',.5),('kick-hard',1)]:
    save(name,.28,lambda t,n,power=power:power*(.65*np.sin(2*np.pi*(105*t-60*t*t))*np.exp(-t*27)+low(n,2200)*.22*np.exp(-t*65)))
save('woodwork',1.0,lambda t,n:sum(.19*np.sin(2*np.pi*f*t)*np.exp(-t*(4+i*2)) for i,f in enumerate([570,1320,2420,3560]))+low(n,5000)*.12*np.exp(-t*65))
save('net',.7,lambda t,n:low(n,4800)*.25*np.exp(-t*7)*(.5+.5*np.sin(t*85)**2))
save('whistle',.28,lambda t,n:(np.sin(2*np.pi*(2600*t+14*np.sin(t*48)))+.3*np.sin(2*np.pi*3100*t))*.22*np.minimum(1,t/.012)*np.minimum(1,(.28-t)/.045))
print('Three attributed recordings and five original effect WAV files ready.')
