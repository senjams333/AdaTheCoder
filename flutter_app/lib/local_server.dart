// The app's own little web server, on the device only (127.0.0.1):
//   /...            the app itself, from inside the app (assets/www): the app's screens, Python (Pyodide), pictures
//   /api/...        passed to the website; the answers are kept on the device, so the app works offline
//                   (newest from the website when there is internet, the kept copy when there isn't)
//   /media/...      lesson pictures and videos from the website, kept on the device after the first time
//   /__ada/input    a child's program waits here for the answer to input() (sent by /__ada/answer)
//   /__ada/sleep    time.sleep() really waits; Stop ends the wait
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';

class LocalServer {
  static const site = 'https://www.adathecoder.com';
  late HttpServer _server;
  late Directory _cache;
  Completer<Map<String, dynamic>>? _input;
  Completer<void> _stop = Completer<void>();
  final HttpClient _client = HttpClient()..connectionTimeout = const Duration(seconds: 15);

  int get port => _server.port;

  Future<void> start() async {
    _cache = Directory('${(await getApplicationSupportDirectory()).path}/ada-cache');
    await _cache.create(recursive: true);
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server.listen((req) => _handle(req).catchError((Object e) => _send(req, 500, 'text/plain', utf8.encode('$e'))));
  }

  Future<void> _handle(HttpRequest req) async {
    final path = req.uri.path;
    if (path == '/__ada/input') {
      _input?.complete({'stop': true});
      final c = _input = Completer<Map<String, dynamic>>();
      final answer = await c.future;
      return _json(req, answer);
    }
    if (path == '/__ada/answer') {
      final body = jsonDecode(await utf8.decodeStream(req)) as Map<String, dynamic>;
      if (body['stop'] == true) {
        if (!_stop.isCompleted) _stop.complete();
        _stop = Completer<void>();
      }
      final c = _input;
      _input = null;
      if (c != null && !c.isCompleted) c.complete(body['stop'] == true ? {'stop': true} : {'text': '${body['text'] ?? ''}'});
      return _json(req, {'ok': true});
    }
    if (path == '/__ada/sleep') {
      final ms = int.tryParse(req.uri.queryParameters['ms'] ?? '') ?? 0;
      final stop = _stop.future;
      var stopped = false;
      await Future.any([Future<void>.delayed(Duration(milliseconds: ms.clamp(0, 30000))), stop.then((_) => stopped = true)]);
      return _json(req, {'stop': stopped});
    }
    if (path.startsWith('/api/')) return _api(req);
    if (path.startsWith('/media/')) return _media(req);
    return _asset(req, path == '/' ? '/index.html' : path);
  }

  // ------------------------------------------------------------------ the app itself (inside the app)
  Future<void> _asset(HttpRequest req, String path) async {
    ByteData data;
    try {
      data = await rootBundle.load('assets/www${Uri.decodeComponent(path)}');
    } catch (_) {
      return _send(req, 404, 'text/plain', utf8.encode('Not found: $path'));
    }
    final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    return _send(req, 200, _type(path), bytes, ranges: true);
  }

  // ------------------------------------------------------------------ the website's answers, kept for offline use
  File _kept(String key) => File('${_cache.path}/${base64Url.encode(utf8.encode(key)).replaceAll('=', '')}');

  Future<void> _api(HttpRequest req) async {
    final key = 'api ${req.uri}';
    final body = req.method == 'GET' ? <int>[] : await req.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
    try {
      final r = await _client.openUrl(req.method, Uri.parse('$site${req.uri}'));
      for (final h in ['authorization', 'content-type', 'accept']) {
        final v = req.headers.value(h);
        if (v != null) r.headers.set(h, v);
      }
      if (body.isNotEmpty) r.add(body);
      final res = await r.close();
      final bytes = await res.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      // pictures and videos the answers point at come through this server too (and are kept on the device)
      final text = utf8.decode(bytes, allowMalformed: true)
          .replaceAll('https://www.adathecoder.com/media/', '/media/')
          .replaceAll('https://adathecoder.com/media/', '/media/');
      final out = utf8.encode(text);
      if (req.method == 'GET' && res.statusCode == 200) await _kept(key).writeAsBytes(out);
      return _send(req, res.statusCode, res.headers.contentType?.toString() ?? 'application/json', out);
    } catch (_) {
      final f = _kept(key);
      if (req.method == 'GET' && await f.exists()) return _send(req, 200, 'application/json', await f.readAsBytes());
      return _send(req, 503, 'application/json', utf8.encode('{"ok":false,"error":"No internet connection."}'));
    }
  }

  Future<void> _media(HttpRequest req) async {
    final key = 'media ${req.uri.path}?${req.uri.query}';
    final f = _kept(key);
    if (await f.exists()) return _send(req, 200, _type(req.uri.path), await f.readAsBytes(), ranges: true);
    try {
      final r = await _client.getUrl(Uri.parse('$site${req.uri}'));
      final res = await r.close();
      final bytes = Uint8List.fromList(await res.fold<List<int>>(<int>[], (a, b) => a..addAll(b)));
      if (res.statusCode == 200) await f.writeAsBytes(bytes);
      return _send(req, res.statusCode, res.headers.contentType?.toString() ?? _type(req.uri.path), bytes, ranges: true);
    } catch (_) {
      return _send(req, 503, 'text/plain', utf8.encode('Offline'));
    }
  }

  // ------------------------------------------------------------------ answers
  Future<void> _json(HttpRequest req, Object value) => _send(req, 200, 'application/json', utf8.encode(jsonEncode(value)));

  Future<void> _send(HttpRequest req, int status, String type, List<int> bytes, {bool ranges = false}) async {
    final res = req.response;
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Access-Control-Allow-Origin', '*');
    var body = bytes;
    final range = ranges ? req.headers.value('range') : null;
    if (range != null && status == 200) {
      final m = RegExp(r'bytes=(\d*)-(\d*)').firstMatch(range);
      final start = int.tryParse(m?.group(1) ?? '') ?? 0;
      final end = (int.tryParse(m?.group(2) ?? '') ?? bytes.length - 1).clamp(0, bytes.length - 1);
      if (start < bytes.length) {
        body = bytes.sublist(start, end + 1);
        status = 206;
        res.headers.set('Content-Range', 'bytes $start-$end/${bytes.length}');
      }
    }
    if (ranges) res.headers.set('Accept-Ranges', 'bytes');
    res.statusCode = status;
    res.headers.contentType = ContentType.parse(type);
    res.contentLength = body.length;
    res.add(body);
    await res.close();
  }

  static String _type(String path) {
    final p = path.toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.zip': 'application/zip',
      '.py': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff',
      '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
    };
    for (final e in types.entries) {
      if (p.endsWith(e.key)) return e.value;
    }
    return 'application/octet-stream';
  }
}
