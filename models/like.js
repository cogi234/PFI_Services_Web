import Model from './model.js';

export default class Like extends Model {
    constructor()
    {
        super(false);
        this.addField('UserId', 'string');
        this.addField('PostId', 'string');
    }
}