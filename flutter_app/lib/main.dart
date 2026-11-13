// Ada The Coder for Android and iOS: the Windows app's own screens (desktop_app/assets/app, built by the app's own
// Python running on the device with Pyodide), full screen and sideways, inside a web view (Flutter's own webview_flutter).
// Everything the app needs is inside it (assets/www, made by tool/prepare.sh); LocalServer serves it, passes the
// website's answers through (and keeps them for offline use), and lets a child's program wait for input() answers.
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

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
  late final WebViewController _web;

  static Future<void> _openOutside(String url) async {
    final u = Uri.tryParse(url);
    if (u != null && (u.scheme == 'http' || u.scheme == 'https')) await launchUrl(u, mode: LaunchMode.externalApplication);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // iPhone/iPad: videos play inside the page; no tap needed before sound or video
    final PlatformWebViewControllerCreationParams params = WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{})
        : const PlatformWebViewControllerCreationParams();
    _web = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFBAE6FD))
      // pages of the website (pay, account, forgot password) open in the phone's browser, never inside the app
      ..addJavaScriptChannel('AdaApp', onMessageReceived: (m) => _openOutside(m.message))
      ..setNavigationDelegate(NavigationDelegate(onNavigationRequest: (request) {
        final u = Uri.tryParse(request.url);
        if (u != null && (u.scheme == 'http' || u.scheme == 'https') && u.host != '127.0.0.1') {
          _openOutside(request.url);
          return NavigationDecision.prevent;
        }
        return NavigationDecision.navigate;
      }))
      ..loadRequest(Uri.parse('http://127.0.0.1:${widget.server.port}/index.html'));
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
      AndroidWebViewController.enableDebugging(kDebugMode);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.server.ensureRunning();
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // the Android back button doesn't close the app in the middle of a lesson
      child: Scaffold(
        backgroundColor: const Color(0xFFBAE6FD),
        body: WebViewWidget(controller: _web),
      ),
    );
  }
}
