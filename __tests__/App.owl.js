const {takeScreenshot} = require('react-native-owl');

jest.setTimeout(60000);

const settle = () => new Promise(resolve => setTimeout(resolve, 3000));

describe('ZebraLabel', () => {
  it('matches the home screen baseline', async () => {
    await settle();
    const screen = await takeScreenshot('home-screen');
    expect(screen).toMatchBaseline();
  });
});
