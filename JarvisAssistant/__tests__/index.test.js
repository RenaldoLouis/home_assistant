describe('notification headless task registration', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native');
    jest.dontMock('react-native-android-notification-listener');
    jest.dontMock('../App');
  });

  it('registers the listener with the native service task key', () => {
    jest.isolateModules(() => {
      const registerComponent = jest.fn();
      const registerHeadlessTask = jest.fn();

      jest.doMock('react-native', () => ({
        AppRegistry: {
          registerComponent,
          registerHeadlessTask,
        },
      }));
      jest.doMock('react-native-gesture-handler', () => undefined);
      jest.doMock('react-native-get-random-values', () => undefined);
      jest.doMock('react-native-android-notification-listener', () => ({
        __esModule: true,
        default: {
          getPermissionStatus: jest.fn(),
          requestPermission: jest.fn(),
        },
        RNAndroidNotificationListenerHeadlessJsName:
          'RNAndroidNotificationListenerHeadlessJs',
      }));
      jest.doMock('../App', () => ({
        __esModule: true,
        default: () => null,
      }));

      require('../index');

      expect(registerHeadlessTask).toHaveBeenCalledWith(
        'RNAndroidNotificationListenerHeadlessJs',
        expect.any(Function),
      );
    });
  });
});
