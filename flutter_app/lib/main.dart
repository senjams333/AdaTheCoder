// Ada The Coder for Android and iOS: the Windows app's own screens (desktop_app/assets/app, built by the app's own
// Python running on the device with Pyodide), full screen and sideways, inside a web view. Everything the app needs is
// inside it (assets/www, made by tool/prepare.sh); LocalServer serves it, passes the website's answers through (and
// keeps them for offline use), and lets a child's program wait for input() answers.
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';

import 'local_server.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  final server = LocalServer();
  await server.start();
  runApp(AdaApp(server: server));
}

class AdaApp extends StatelessWidget {
  const AdaApp({super.key, required this.server});
  final LocalServer server;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ada The Coder',
      debugShowCheckedModeBanner: false,
      home: AppScreen(server: server),
    );
  }
}

class AppScreen extends StatefulWidget {
  const AppScreen({super.key, required this.server});
  final LocalServer server;

  @override
  State<AppScreen> createState() => _AppScreenState();
}

class _AppScreenState extends State<AppScreen> with WidgetsBindingObserver {
  LocalServer get server => widget.server;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      server.ensureRunning();
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  static Future<void> _openOutside(Uri url) async {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // the Android back button doesn't close the app in the middle of a lesson
      child: Scaffold(
        backgroundColor: const Color(0xFFBAE6FD),
        body: InAppWebView(
          initialUrlRequest: URLRequest(url: WebUri('http://127.0.0.1:${server.port}/index.html')),
          initialSettings: InAppWebViewSettings(
            javaScriptEnabled: true,
            mediaPlaybackRequiresUserGesture: false,
            allowsInlineMediaPlayback: true,
            supportZoom: false,
            useShouldOverrideUrlLoading: true,
            useHybridComposition: true,
            disableContextMenu: true,
            isInspectable: kDebugMode,
          ),
          onWebViewCreated: (controller) {
            // pages of the website (pay, account, forgot password) open in the phone's browser
            controller.addJavaScriptHandler(
              handlerName: 'openExternal',
              callback: (args) {
                final url = Uri.tryParse(args.isNotEmpty ? '${args[0]}' : '');
                if (url != null && (url.scheme == 'http' || url.scheme == 'https')) _openOutside(url);
                return null;
              },
            );
          },
          shouldOverrideUrlLoading: (controller, action) async {
            final url = action.request.url;
            if (url != null && (url.scheme == 'http' || url.scheme == 'https') && url.host != '127.0.0.1') {
              await _openOutside(Uri.parse(url.toString()));
              return NavigationActionPolicy.CANCEL;
            }
            return NavigationActionPolicy.ALLOW;
          },
        ),
      ),
    );
  }
}
