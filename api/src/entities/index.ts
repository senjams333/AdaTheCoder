import { Course } from './course.entity';
import { Download } from './download.entity';
import { Lesson } from './lesson.entity';
import { Licence } from './licence.entity';
import { Release } from './release.entity';
import { Setting } from './setting.entity';
import { User } from './user.entity';

export { Course, Download, Lesson, Licence, Release, Setting, User };
export type { CharacterPicture } from './course.entity';
export type { Example } from './lesson.entity';
export const ENTITIES = [User, Course, Lesson, Licence, Release, Download, Setting];
