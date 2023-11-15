const crypto = require('crypto');
const fuse = require('node-fuse-bindings');

// MOUNT_PATH это путь, по которому будет доступна наша файловая система. Для win это будет путь вида 'D://'
const MOUNT_PATH = process.env.MOUNT_PATH || './mnt';

function getRandomContent() {
  const txt = [crypto.randomUUID(), new Date().toISOString(), ''].join('\n');
  return Buffer.from(txt);
}

function main() {
  // fd это простой счетчик, который увеличивается при каждом открытии файла
  // по нему мы можем получить содержимое файла, которое уникально для каждого открытия
  let fdCounter = 0;

  // fd2ContentMap это мапа, которая хранит содержимое файла по fd
  const fd2ContentMap = new Map();

  // Postman не работает стабильно, если мы передадим ему файл с размером 0 или просто с неправильным размером,
  // поэтому заранее вычисляем размер файла
  // гарантируется что размер файла будет всегда одинаковый в рамках одного запуска, поэтому с этим проблем не возникнет
  const randomTxtSize = getRandomContent().length;

  // fuse.mount это функция, которая монтирует файловую систему
  fuse.mount(
    MOUNT_PATH,
    {
      readdir(path, cb) {
        console.log('readdir(%s)', path);

        if (path === '/') {
          return cb(0, ['random.txt']);
        }

        return cb(0, []);
      },
      getattr(path, cb) {
        console.log('getattr(%s)', path);

        if (path === '/') {
          return cb(0, {
            // mtime это время последней модификации файла
            mtime: new Date(),
            // atime это время последнего доступа к файлу
            atime: new Date(),
            // ctime это время последнего изменения метаданных или содержимого файла
            ctime: new Date(),
            size: 100,
            // mode это права доступа к файлу
            // это маска, которая определяет права доступа к файлу для разных типов пользователей
            // и сам тип файла
            mode: 16877,
            // владельцы файла
            // для нашего случая это будет владелец текущего процесса
            uid: process.getuid(),
            gid: process.getgid(),
          });
        }

        if (path === '/random.txt') {
          return cb(0, {
            mtime: new Date(),
            atime: new Date(),
            ctime: new Date(),
            size: randomTxtSize,
            mode: 33188,
            uid: process.getuid(),
            gid: process.getgid(),
          });
        }

        cb(fuse.ENOENT);
      },
      open(path, flags, cb) {
        console.log('open(%s, %d)', path, flags);

        if (path !== '/random.txt') return cb(fuse.ENOENT, 0);

        const fd = fdCounter++;
        fd2ContentMap.set(fd, getRandomContent());
        cb(0, fd);
      },
      read(path, fd, buf, len, pos, cb) {
        console.log('read(%s, %d, %d, %d)', path, fd, len, pos);

        const buffer = fd2ContentMap.get(fd);
        if (!buffer) {
          return cb(fuse.EBADF);
        }

        const slice = buffer.slice(pos, pos + len);
        slice.copy(buf);

        return cb(slice.length);
      },
      release(path, fd, cb) {
        console.log('release(%s, %d)', path, fd);

        fd2ContentMap.delete(fd);
        cb(0);
      },
    },
    function (err) {
      if (err) throw err;
      console.log('filesystem mounted on ' + MOUNT_PATH);
    },
  );
}

// отдельно обрабатываем сигнал SIGINT, чтобы корректно отмонтировать файловую систему
// без этого ФС не будет отмонтирована и будет висеть в системе
// если по разным причинам unmount не был вызван, то можно принудительно отмонтировать ФС через команду
// fusermount -u ./MOUNT_PATH
process.on('SIGINT', function () {
  fuse.unmount(MOUNT_PATH, function () {
    console.log('filesystem at ' + MOUNT_PATH + ' unmounted');
    process.exit();
  });
});

main();
