import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { parseFolgerTei } from './folger-tei';

describe('parseFolgerTei with non-Folger TEI', () => {
	it('derives characters from <speaker> when speeches have no @who', () => {
		const xml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>The Shepherd</title></titleStmt><publicationStmt><p/></publicationStmt></fileDesc></teiHeader>
		<text><body><div type="act" n="1"><div type="scene" n="1">
			<sp><speaker>CORIN.</speaker><l>Good morrow, sir.</l></sp>
			<sp><speaker>SILVIUS.</speaker><l>And to you, old Corin.</l><l>What news?</l></sp>
			<sp><speaker>CORIN.</speaker><p>None that will please you.</p></sp>
		</div></div></body></text></TEI>`;
		const play = parseFolgerTei(new DOMParser().parseFromString(xml, 'text/xml') as never);
		expect(play.title).toBe('The Shepherd');
		expect(play.characters.map((c) => [c.name, c.stats.speeches, !!c.minor])).toEqual([
			['Corin', 2, false],
			['Silvius', 1, false]
		]);
	});
});
