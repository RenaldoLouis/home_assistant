const fs = require('fs');
const path = require('path');

describe('Android notification listener manifest', () => {
  it('declares the installed notification listener service class', () => {
    const manifest = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'android',
        'app',
        'src',
        'main',
        'AndroidManifest.xml',
      ),
      'utf8',
    );

    expect(manifest).toContain(
      'com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener',
    );
    expect(manifest).not.toContain(
      'com.reactnativeandroidnotificationlistener.RNAndroidNotificationListener',
    );
  });
});
