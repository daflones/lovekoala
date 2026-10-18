"""Prepare a licensed real page turn. No synthetic noise or runtime dependency.
Source: https://freesound.org/people/OwlStorm/sounds/151220/
Author: OwlStorm / Ashe Kirk / Owlish Media. License: CC0 1.0.
"""
import pathlib,subprocess,tempfile,urllib.request,wave
source='https://cdn.freesound.org/previews/151/151220_140737-hq.mp3'
with tempfile.TemporaryDirectory() as tmp:
    original=pathlib.Path(tmp)/'recording.mp3'
    original.write_bytes(urllib.request.urlopen(source,timeout=30).read())
    destination=pathlib.Path('public/assets/page-turn.wav')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(original),'-af','highpass=f=140,lowpass=f=9000,afade=t=in:d=0.018,areverse,afade=t=in:d=0.035,areverse,volume=0.65','-ac','1','-ar','44100',str(destination)],check=True)
    with wave.open(str(destination)) as audio:
        print({'asset':str(destination),'seconds':audio.getnframes()/audio.getframerate(),'recorded':True,'license':'CC0 1.0'})
